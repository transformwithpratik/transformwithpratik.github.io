import numpy as np, scipy.signal as sg, scipy.io.wavfile as wv, json
SR=44100; TL=json.load(open('timeline.json')); N=int((TL['total']+0.6)*SR); rng=np.random.default_rng(11)
def lp(x,f,o=2): b,a=sg.butter(o,f/(SR/2)); return sg.lfilter(b,a,x)
def hp(x,f,o=2): b,a=sg.butter(o,f/(SR/2),'high'); return sg.lfilter(b,a,x)
def bp(x,f1,f2,o=2): b,a=sg.butter(o,[f1/(SR/2),f2/(SR/2)],'band'); return sg.lfilter(b,a,x)
def T(d): return np.arange(int(d*SR))/SR
def whoosh(d=0.38, up=True):
    t=T(d); n=len(t); nz=rng.normal(0,1,n); out=np.zeros(n); blk=512
    for i in range(0,n,blk):
        u=i/n; fc=(400*(12**u)) if up else (5000*(0.08**u)); seg=np.concatenate([nz[max(0,i-1024):i],nz[i:i+blk]]); out[i:i+blk]=bp(seg,max(80,fc*0.6),min(fc*1.6,19000))[-len(nz[i:i+blk]):]
    e=np.sin(np.pi*np.clip(t/d,0,1))**1.6; return out*e*0.9
def pop():
    t=T(0.09); f=1100*np.exp(-t*30)+260; x=np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t*45); return x*0.7
def click():
    t=T(0.03); x=hp(rng.normal(0,1,len(t)),2500)*np.exp(-t*400)+np.sin(2*np.pi*3200*t)*np.exp(-t*160)*0.5; return x*0.6
def ding():
    t=T(1.0); x=sum(a*np.sin(2*np.pi*f*t)*np.exp(-t*k) for f,a,k in ((1318.5,0.6,4),(1975.5,0.35,5),(2637,0.25,7),(3951,0.1,9))); return x*np.minimum(1,t/0.002)*0.55
def buzz():
    t=T(0.32); x=np.sign(np.sin(2*np.pi*95*t))*0.35+np.sin(2*np.pi*190*t)*0.3; x=lp(x,1600)*np.exp(-t*6)
    th=np.sin(2*np.pi*np.cumsum(70*np.exp(-t*8)+40)/SR)*np.exp(-t*12); return (x+th)*0.8
def sparkle():
    t=T(0.9); x=np.zeros(len(t))
    for k,f in enumerate([1568,2093,2637,3136,4186]):
        i=int(k*0.07*SR); tt=t[:len(t)-i]; x[i:]+=np.sin(2*np.pi*f*tt)*np.exp(-tt*7)*0.25
    return x
def typing(n=8, d=0.75):
    x=np.zeros(int((d+0.05)*SR))
    for k in range(n):
        c=click()*rng.uniform(0.5,0.9); i=int(k*d/n*SR+rng.uniform(0,0.02)*SR); x[i:i+len(c)]+=c[:len(x)-i]
    return x
def power():
    t=T(0.6); f=200*(6**(t/0.6)); x=np.sin(2*np.pi*np.cumsum(f)/SR)*(t/0.6)**1.5*0.4; return x+whoosh(0.6)*0.3
buf=np.zeros((2,N))
def put(x,t,g=1.0,pan=0.0):
    i=int(t*SR); 
    if i<0: x=x[-i:]; i=0
    L=min(len(x),N-i); buf[0,i:i+L]+=x[:L]*g*(1-max(0,pan)); buf[1,i:i+L]+=x[:L]*g*(1+min(0,pan))
G={g['scene']:g for g in TL['gfx']}; O=TL['ov']
def gc(s,k): return G[s]['start']+G[s]['cues'][k]
ev=[]
# transitions (whoosh centred on the cut)
cuts=[G['meal']['start'],G['curious']['start'],G['walk']['start'],O['why'][0],G['muscle']['start'],G['body']['start'],O['todo'][0],G['couch']['start'],G['walk10']['start'],G['norun']['start'],G['easy']['start'],O['move'][0],O['cta'][0]]
for i,c in enumerate(cuts):
    if c in (O['why'][0],O['move'][0]): continue
    put(whoosh(0.34, i%2==0),c-0.2,0.55,pan=(-0.3 if i%2 else 0.3))
# hook
put(pop(),0.30,0.5)          # second title line
put(click(),0.5,0.5)         # name tag
# meal
put(pop(),G['meal']['start']+0.25,0.45); put(pop(),G['meal']['start']+0.5,0.35)
put(click(),gc('meal','carb'),0.6)
put(power(),gc('meal','rise')-0.1,0.45)
put(pop(),gc('meal','rise')+0.45,0.5)
# curious
put(sparkle(),G['curious']['start']+0.12,0.6)
# walk
put(click(),G['walk']['start']+0.5,0.5)
put(ding(),gc('walk','reduce')+0.35,0.35)
# muscle
put(pop(),gc('muscle','contract'),0.5); put(click(),gc('muscle','glucose'),0.55); put(power(),gc('muscle','fuel')-0.35,0.5)
# body
put(sparkle(),G['body']['start']+0.4,0.3)
# todo
put(pop(),O['todo'][0]+0.05,0.5)
# couch
put(pop(),gc('couch','lunch'),0.5,-0.3); put(pop(),gc('couch','dinner'),0.5,0.3); put(buzz(),gc('couch','cross'),0.7)
# walk10 / norun / easy
put(ding(),gc('walk10','tick'),0.55)
put(buzz(),gc('norun','cross'),0.65)
put(click(),G['easy']['start']+0.4,0.4); put(click(),G['easy']['start']+0.55,0.35); put(ding(),G['easy']['start']+0.9,0.4)
# cta
put(pop(),O['cta'][0]+0.1,0.55); put(typing(10,0.75),O['cta'][0]+0.62,0.45); put(pop(),O['cta'][0]+1.35,0.5)
wv.write('aud/sfx.wav',SR,(np.clip(buf,-1,1).T*32767).astype(np.int16))
print('sfx ok')
