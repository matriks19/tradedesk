import json,pandas as pd,numpy as np
TR=json.load(open('/tmp/qx/v4/labtrades.json'))
legs={}
for k in TR: legs[k]=pd.DataFrame(TR[k],columns=['te','tx','sym','ret'])
for nm,f in [('t42c','/workspace/triple_rsi_lab/trades_COIN_1d_A_close_stop20.csv'),('t42b','/workspace/triple_rsi_lab/trades_BIST_1d_A_close.csv')]:
  legs[nm]=pd.read_csv(f)[['te','tx','sym','ret']]
legs['pst']=pd.DataFrame(columns=['te','tx','sym','ret'])
def st(r):
  r=np.asarray(r,float);n=len(r)
  if n==0:return dict(n=0)
  w=r[r>0];l=r[r<=0];p=len(w)/n;aw=w.mean() if len(w) else 0;al=-l.mean() if len(l) else 0
  b=aw/al if al>0 else 99;return dict(n=n,p=round(p,4),b=round(b,3),ev=round(p*b-(1-p),4),avgW=round(aw*100,2),avgL=round(al*100,2))
out={'v':134,'built':'2026-10-21','k':30,'minN':30,'legs':{}}
K=30
for k,d in legs.items():
  d=d.sort_values('te');S=st(d.ret);h=len(d)//2
  S['is']=st(d.ret.iloc[:h]);S['oos']=st(d.ret.iloc[h:])
  coins={}
  if S['n']:
    for sym,g in d.groupby('sym'):
      c=st(g.ret);n=c['n'];wt=n/(n+K)
      p=wt*c['p']+(1-wt)*S['p'];b=wt*min(c['b'],10)+(1-wt)*S['b']
      coins[sym]=dict(n=n,p=round(p,4),b=round(b,3),ev=round(p*b-(1-p),4),own=n>=30)
  S['coins']=coins;out['legs'][k]=S
  print(k,{x:S[x] for x in S if x not in('coins',)})
json.dump(out,open('ev_stats.json','w'),separators=(',',':'))
