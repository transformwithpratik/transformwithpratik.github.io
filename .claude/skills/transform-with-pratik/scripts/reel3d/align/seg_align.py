import json, numpy as np, scipy.io.wavfile as wv, struct, subprocess
from align import tts_word, mfcc
def norm(t): return t.replace('-', ' ').replace('10', 'ten').replace("'", '').strip('.,?!…')
def align_seg(audio, t0, t1, words):
    sr,a=wv.read(audio); a=a.astype(float)/32768
    seg=a[int(t0*sr):int(t1*sr)]
    parts=[]; bounds=[]; pos=0
    for w in words:
        x=np.concatenate([tts_word(sw) for sw in norm(w).split()]); bounds.append((pos,pos+len(x))); parts.append(x); pos+=len(x)
    T=np.concatenate(parts)
    FA,_=mfcc(seg); FB,_=mfcc(T)
    A=FA.astype(np.float32); B=FB.astype(np.float32)
    with open('s.bin','wb') as f: f.write(struct.pack('iii',len(A),len(B),A.shape[1])); f.write(A.tobytes()); f.write(B.tobytes())
    subprocess.run(['./dtw','s.bin','s.txt'],check=True)
    p=np.loadtxt('s.txt',dtype=int).reshape(-1,2)[::-1]
    first={}
    for ia,ib in p: first.setdefault(ib,ia)
    out=[]
    for k,(w,(s,e)) in enumerate(zip(words,bounds)):
        fs=min(int(s/160),len(B)-1); ts=t0+first.get(fs,0)*0.01
        out.append([w,ts])
    out[0][1]=t0
    res=[]
    for k,(w,ts) in enumerate(out):
        te=out[k+1][1] if k+1<len(out) else t1
        res.append({'w':w,'s':round(ts,3),'e':round(te,3)})
    return res
def build(audio, plan, keys):
    allw=[]
    for (t0,t1,text,tag) in plan:
        ws=align_seg(audio,t0,t1,text.split())
        for w in ws: w['k']=any(k in w['w'].lower() for k in keys); w['seg']=tag
        allw+=ws
    return allw
if __name__=='__main__':
    hook=build('../audio/hook.wav',[(0.20,1.26,"Here's one small habit",'h1'),(1.39,2.04,"that can make",'h2'),(2.21,2.85,"a surprisingly",'h3'),(2.87,4.09,"big difference to your blood sugar.",'h4')],['small','habit','big','difference','blood','sugar'])
    main_plan=[(0.37,1.13,"Every time you eat,",'A'),(1.75,3.19,"especially a carbohydrate-rich meal,",'B'),(3.32,4.07,"your blood glucose",'D'),(4.15,4.86,"naturally rises.",'E'),
      (5.95,6.90,"But here's something interesting.",'F'),(7.50,8.99,"Walking shortly after eating",'G'),(9.40,11.25,"can help reduce that post-meal glucose spike.",'H'),(12.28,12.50,"Why?",'I'),
      (13.73,14.70,"Because when you walk,",'J'),(14.86,16.41,"your muscles start contracting",'KL'),(16.74,18.17,"and using glucose from your bloodstream",'M'),(18.30,19.01,"as fuel.",'N'),
      (19.84,20.94,"This helps your body",'Q'),(21.09,22.01,"manage the glucose",'T'),(22.37,22.99,"coming from your meal.",'U'),(23.76,24.79,"So here's what you can do.",'V'),
      (25.65,26.65,"After lunch or dinner,",'W'),(26.85,28.61,"instead of immediately sitting on your couch,",'X'),(32.00,33.08,"try a 10-minute walk.",'AB'),
      (33.80,34.78,"You don't need to run.",'AC'),(35.07,36.67,"You don't need to walk extremely fast.",'AD'),(37.17,37.66,"Just move!",'AF')]
    keys=['carbohydrate','glucose','rises','interesting','walking','reduce','spike','why','muscles','contracting','fuel','couch','10-minute','run','fast','move']
    main=build('../audio/main.wav',main_plan,keys)
    json.dump({'hook':hook,'main':main},open('words.json','w'),indent=0)
    for w in hook+main: print(f"{w['seg']:3s} {w['s']:6.2f}-{w['e']:6.2f} {'*' if w['k'] else ' '} {w['w']}")
