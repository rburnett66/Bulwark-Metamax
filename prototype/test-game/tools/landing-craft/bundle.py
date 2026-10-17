# Tiny ES-module bundler for the review pages: wraps each module in its own function scope, turns its named
# imports into reads from one shared namespace object and its exports into writes to it. Enough for the plain
# ES modules under src/render3d (named imports/exports only, no defaults, no cycles in the order given).
# THREE stays a global (the pages load three.js r128 classic). [MM-epic_mvbkrvnz_2]
import re, os

IMPORT = re.compile(r"^\s*import\s*\{([^}]*)\}\s*from\s*['\"][^'\"]+['\"];?\s*$", re.M)
SIDE_IMPORT = re.compile(r"^\s*import\s+['\"][^'\"]+['\"];?\s*$", re.M)
EXPORT_DECL = re.compile(r"^export\s+(async\s+function|function|const|let|class)\s+([A-Za-z_$][\w$]*)", re.M)
EXPORT_LIST = re.compile(r"^export\s*\{([^}]*)\};?\s*$", re.M)


def wrap(path, ns='LC'):
    src = open(path, encoding='utf-8').read()
    names = [m.group(2) for m in EXPORT_DECL.finditer(src)]
    for m in EXPORT_LIST.finditer(src):
        names += [n.split(' as ')[-1].strip() for n in m.group(1).split(',') if n.strip()]

    def imp(m):
        parts = []
        for n in m.group(1).split(','):
            n = n.strip()
            if not n:
                continue
            a, _, b = n.partition(' as ')
            parts.append(f'{a.strip()}: {b.strip()}' if b else a.strip())
        return f"const {{ {', '.join(parts)} }} = {ns};"

    src = IMPORT.sub(imp, src)
    src = SIDE_IMPORT.sub('', src)
    src = EXPORT_DECL.sub(lambda m: f'{m.group(1)} {m.group(2)}', src)
    src = EXPORT_LIST.sub('', src)
    rel = os.path.relpath(path)
    return f"// ── {rel}\n(function () {{\n{src}\nObject.assign({ns}, {{ {', '.join(names)} }});\n}})();\n"


def bundle(paths, ns='LC'):
    return f'var {ns} = {ns} || {{}};\n' + '\n'.join(wrap(p, ns) for p in paths)
