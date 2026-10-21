import json,numpy as np,pandas as pd
D=json.load(open('/tmp/qx/v4/labdata.json'));C1=json.load(open('/tmp/qx/v4/labc1.json'))
def rma(x,n):
  return pd.Series(x).ewm(alpha=1/n,adjust=False).mean().values
def rsi(c,n):
  d=np.diff(c,prepend=c[0]);u=rma(np.maximum(d,0),n);dn=rma(np.maximum(-d,0),n);return 100-100/(1+u/np.where(dn==0,1e-12,dn))
def stoch(h,l,c,n):
  H=pd.Series(h).rolling(n).max().values;L=pd.Series(l).rolling(n).min().values;return 100*(c-L)/np.where(H-L==0,np.nan,H-L)
def sma(x,n):return pd.Series(x).rolling(n).mean().values
def xup(a,b):a=np.asarray(a);b=np.asarray(b) if np.ndim(b) else np.full(len(a),b);return np.r_[False,(a[1:]>b[1:])&(a[:-1]<=b[:-1])]
def sigs(o,h,l,c,v):
  r=rsi(c,14);r200=rsi(c,200);S={}
  S['t16']=(r>=20)&(r<=30)&~np.r_[False,(r[:-1]>=20)&(r[:-1]<=30)]
  S['t25']=(r>=20)&(r<=40)&(l<=sma(c,20)-2*pd.Series(c).rolling(20).std().values)
  S['t8']=xup(r,r200)
  # T12 basit boğa uyumsuzluk: fiyat 20 mumluk yeni dip, RSI dipten yüksek, RSI<40
  ll=pd.Series(l).rolling(20).min().shift(1).values;rl=pd.Series(r).rolling(20).min().shift(1).values
  S['t12']=(l<ll)&(r>rl+3)&(r<40)
  sr=stoch(r,r,r,14);k=sma(sr,3);d=sma(k,3)
  S['t13']=xup(k,d)&(k<20)
  st14=stoch(h,l,c,14);kk=rma(np.nan_to_num(st14,nan=50),3);dd=rma(kk,3)
  S['t36']=xup(kk,dd)&(kk<20)
  s200=stoch(h,l,c,200);k2=sma(s200,3);d2=sma(k2,3);S['t6']=xup(k2,d2)&(k2<30)
  S['t3']=(r>40)&(r<60)&xup(sma(st14,3),sma(sma(st14,3),3))
  tp=(h+l+c)/3;mf=tp*v;dtp=np.diff(tp,prepend=tp[0]);pos=pd.Series(np.where(dtp>0,mf,0)).rolling(14).sum().values;neg=pd.Series(np.where(dtp<0,mf,0)).rolling(14).sum().values
  mfi=100-100/(1+pos/np.where(neg==0,1e-12,neg));S['t14']=xup(mfi,20) if v.sum()>0 else np.zeros(len(c),bool)
  vw=pd.Series(tp*v).rolling(20).sum().values/np.where(pd.Series(v).rolling(20).sum().values==0,np.nan,pd.Series(v).rolling(20).sum().values)
  return S,c<vw
def bt(o,h,l,c,t,m,below,tp=.10,sl=.05,mx=48,fee=.001):
  out=[];i=210;n=len(c)
  while i<n-1:
    if m[i]:
      e=o[i+1] if o[i+1]>0 else c[i];r=None
      for j in range(i+1,min(n,i+1+mx)):
        if l[j]<=e*(1-sl):r=-sl;break
        if h[j]>=e*(1+tp):r=tp;break
      if r is None:j=min(n-1,i+mx);r=c[j]/e-1
      out.append((t[i],r-fee,bool(below[i])));i=j+1
    else:i+=1
  return out
def st(r):
  r=np.asarray(r,float);n=len(r)
  if not n:return dict(n=0)
  w=r[r>0];L=r[r<=0];p=len(w)/n;b=(w.mean() if len(w) else 0)/(-L.mean()) if len(L) and L.mean()<0 else 9.99
  return dict(n=n,p=round(p,4),b=round(float(b),3),ev=round(p*b-(1-p),4))
sets={'coin|4h':D['c4'],'coin|1h':C1,'bist|1h':D['b1']}
R={}
for key,U in sets.items():
  T={}
  for sym,a in U.items():
    A=np.array(a,float);t,o,h,l,c,v=A[:,0],A[:,1],A[:,2],A[:,3],A[:,4],A[:,5]
    S,bel=sigs(o,h,l,c,v)
    for k,m in S.items():T.setdefault(k,[]).extend(bt(o,h,l,c,t,np.nan_to_num(m).astype(bool),np.nan_to_num(bel).astype(bool)))
  for k,tr in T.items():
    tr.sort();rr=[x[1] for x in tr];hh=len(tr)//2;g=st(rr);g['oos']=st(rr[hh:]).get('ev')
    ob=[x[1] for x in tr[hh:] if x[2]];oa=[x[1] for x in tr[hh:] if not x[2]]
    g['below']=st([x[1] for x in tr if x[2]]);g['oosBelow']=st(ob).get('ev');g['oosAbove']=st(oa).get('ev');g['nOB']=len(ob)
    R[k+'|'+key]=g;print(k,key,g)
json.dump(R,open('ev2.json','w'),separators=(',',':'))
