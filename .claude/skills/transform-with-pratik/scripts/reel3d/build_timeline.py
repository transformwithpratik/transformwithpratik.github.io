import json, re
W=json.load(open('align/words.json'))
def syl(w):
    w=w.lower().replace('10-minute','ten minute').replace('-',' ')
    n=0
    for part in w.split():
        p=re.sub(r'[^a-z]','',part)
        if not p: continue
        g=len(re.findall(r'[aeiouy]+',p))
        if p.endswith('e') and not p.endswith(('le','ee')) and g>1: g-=1
        if p.endswith(('es','ed')) and g>1 and not p.endswith(('ses','zes','ches','shes','ges','ces','ted','ded')): g-=1
        n+=max(1,g)
    return n
def smooth(words):
    out=[]; segs={}
    for w in words: segs.setdefault(w['seg'],[]).append(w)
    for tag,ws in segs.items():
        s0=ws[0]['s']; e1=ws[-1]['e']; tot=sum(syl(w['w']) for w in ws); acc=0
        for w in ws:
            ps=s0+(e1-s0)*acc/tot; acc+=syl(w['w']); pe=s0+(e1-s0)*acc/tot
            w['s2']=0.5*ps+0.5*w['s']; w['e2']=0.5*pe+0.5*w['e']
        for i in range(1,len(ws)): ws[i]['s2']=max(ws[i]['s2'],ws[i-1]['s2']+0.09)
        for i in range(len(ws)-1): ws[i]['e2']=ws[i+1]['s2']
        ws[-1]['e2']=e1
        out+=ws
    return out
hook=smooth(W['hook']); main=smooth(W['main'])
# clips: (src, in, out, tag)
clips=[('hook',0.12,4.14,'hook'),
 ('main',0.31,1.19,'A'),('main',1.69,4.92,'BE'),('main',5.89,6.96,'F'),('main',7.44,9.05,'G'),('main',9.34,11.31,'H'),
 ('main',12.20,12.72,'I'),('main',13.67,16.47,'JKL'),('main',16.68,19.07,'MN'),('main',19.78,22.07,'QT'),('main',22.31,23.05,'U'),
 ('main',23.70,24.85,'V'),('main',25.59,28.67,'WX'),('main',31.94,33.14,'AB'),('main',33.74,34.84,'AC'),('main',35.01,36.73,'AD'),('main',37.11,37.84,'AF'),
 ('cta',0.30,2.22,'cta')]
T=0; tl=[]
for src,a,b,tag in clips:
    tl.append({'src':src,'in':a,'out':b,'tag':tag,'t0':round(T,4),'t1':round(T+b-a,4)}); T+=b-a
total=T
def to_tl(src,t):
    for c in tl:
        if c['src']==src and c['in']-1e-6<=t<=c['out']+1e-6: return c['t0']+(t-c['in'])
    return None
caps=[]
for src,ws in (('hook',hook),('main',main)):
    for w in ws:
        s=to_tl(src,w['s2']); e=to_tl(src,w['e2'])
        if s is None or e is None: print('drop',w); continue
        caps.append({'w':w['w'],'s':round(s,3),'e':round(e,3),'k':w['k'],'seg':w['seg']})
def wt(word, seg, which='s'):
    for c in caps:
        if c['seg']==seg and c['w'].lower().startswith(word.lower()): return c[which]
    raise Exception(word+seg)
ct={c['tag']:c for c in tl}
gfx=[
 {'scene':'meal','start':ct['A']['t0'],'end':ct['BE']['t1'],'cues':{'carb':wt('carbohydrate','B'),'rise':wt('glucose','D')}},
 {'scene':'curious','start':ct['F']['t0'],'end':ct['F']['t1'],'cues':{}},
 {'scene':'walk','start':ct['G']['t0'],'end':ct['H']['t1'],'cues':{'red':ct['G']['t0']+0.15,'reduce':wt('reduce','H')}},
 {'scene':'muscle','start':ct['JKL']['t0'],'end':ct['MN']['t1'],'cues':{'contract':wt('contracting','KL'),'glucose':wt('glucose','M'),'fuel':wt('fuel','N')}},
 {'scene':'body','start':ct['QT']['t0'],'end':ct['U']['t1'],'cues':{}},
 {'scene':'couch','start':ct['WX']['t0'],'end':ct['WX']['t1'],'cues':{'cross':wt('sitting','X'),'lunch':wt('lunch','W'),'dinner':wt('dinner','W')}},
 {'scene':'walk10','start':ct['AB']['t0'],'end':ct['AB']['t1'],'cues':{'tick':wt('walk','AB')}},
 {'scene':'norun','start':ct['AC']['t0'],'end':ct['AC']['t1'],'cues':{'cross':wt('run','AC')}},
 {'scene':'easy','start':ct['AD']['t0'],'end':ct['AD']['t1'],'cues':{'fast':wt('fast','AD')}},
]
for g in gfx:
    g['cues']={k:round(v-g['start'],3) for k,v in g['cues'].items()}
ov={'hook':[ct['hook']['t0'],ct['hook']['t1']],'why':[ct['I']['t0'],ct['I']['t1']],'todo':[ct['V']['t0'],ct['V']['t1']],
    'move':[ct['AF']['t0'],ct['AF']['t1']],'cta':[ct['cta']['t0'],ct['cta']['t1']],
    'whyWord':wt('why','I'),'moveWord':wt('just','AF'),'todoWord':wt('so','V')}
data={'total':round(total,3),'clips':tl,'caps':caps,'gfx':gfx,'ov':ov}
json.dump(data,open('timeline.json','w'),indent=1)
open('gfx/timeline.js','w').write('const TL = '+json.dumps(data)+';\n')
print('total',round(total,2))
for g in gfx: print(g['scene'],round(g['start'],2),round(g['end'],2),round(g['end']-g['start'],2),g['cues'])
print(ov)
