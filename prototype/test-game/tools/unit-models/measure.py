import sys, numpy as np
from PIL import Image
from scipy import ndimage
import os; os.chdir(os.path.dirname(os.path.abspath(__file__)))
U='ref/'
SHEETS={'tank':'source_tank.jpg','buggy':'source_buggy.jpg','beetle':'source_beetle.jpg','jet':'source_jet.jpg'}
NAMES=['front','side','top','rear']
def views(key):
    im=np.asarray(Image.open(U+SHEETS[key]).convert('RGB')).astype(int)
    m=(im.min(axis=2)<238)
    mc=ndimage.binary_closing(m,iterations=6)
    lab,n=ndimage.label(mc); objs=[o for o in ndimage.find_objects(lab) if (o[0].stop-o[0].start)*(o[1].stop-o[1].start)>20000]
    # order: sort by y then x -> front(top-left), side(top-right), top(bottom-left), rear(bottom-right)
    objs.sort(key=lambda o:(round(o[0].start/300), o[1].start))
    if key=='jet': pass
    out={}
    for name,o in zip(NAMES,objs):
        crop=im[o[0],o[1]]; mask=ndimage.binary_fill_holes(m[o[0],o[1]])
        out[name]=(crop,mask,o)
    return out
if __name__=='__main__':
    key=sys.argv[1]; V=views(key)
    for name,(crop,mask,o) in V.items():
        h,w=mask.shape
        Image.fromarray(crop.astype('uint8')).save(f'ref/{key}_{name}.png')
        Image.fromarray((mask*255).astype('uint8')).save(f'ref/{key}_{name}_mask.png')
        print(f'== {name} {w}x{h}')
        # column profile: for N columns, top & bottom as fraction of h, 0=top
        N=20
        cols=[]
        for i in range(N):
            x=int((i+0.5)*w/N); c=np.where(mask[:,x])[0]
            cols.append(f'{c[0]/h:.2f}-{c[-1]/h:.2f}' if len(c) else '--')
        print(' cols(top-bot):',' '.join(cols))
        rows=[]
        for i in range(N):
            y=int((i+0.5)*h/N); r=np.where(mask[y,:])[0]
            rows.append(f'{r[0]/w:.2f}-{r[-1]/w:.2f}' if len(r) else '--')
        print(' rows(l-r):',' '.join(rows))
