import json,glob,os,collections,itertools
T=json.load(open('td_ev.json'))
def load(tf):
  D={}
  for f in glob.glob(f'out/*USDT_{tf}.json'):
    D[f]=json.load(open(f))
  return D
def run(D,chips,K,M=2,cool=12):
  res=[]
  for f,h in D.items():
    by=collections.defaultdict(dict);N=0
    for k,i,r,n in h:
      if k in chips: by[i][k]=r;N=n
    last=-999;idx=sorted(by)
    for i in idx:
      if i-last<cool:continue
      v=set()
      for j in range(i-M+1,i+1):v|=set(by.get(j,{}))
      if len(v)>=K and by[i]:
        res.append((i>=500+(N-500)/2,list(by[i].values())[0]));last=i
  def st(x):
    w=[r for r in x if r>0];l=[-r for r in x if r<=0]
    if not w or not l:return (len(x),0,0,-1)
    p=len(w)/len(x);b=(sum(w)/len(w))/(sum(l)/len(l));return (len(x),round(p,3),round(b,2),round(p*b-(1-p),3))
  return st([r for _,r in res]),st([r for s,r in res if s])
C1=['pliDir:pli_hi_up','pliDtDiv:pdt_bull','maSimple:x_50_200','ema30Band:e30_brk_long','pliDir:pli_lo_up','divScan:macd_hist|hid_bull','ema30Band:e30_rev_long']
C4=['pliDtDiv:pdt_d_div','gold2:div_bull','ema30Band:e30_long','ema30Band:e30_rev_long','pliDir:pli_lo_up','pliDmi:comb_top','gold:div_bull','pliDtDiv:pdt_bull','maSimple:x_20_200']
out=[]
for tf,C in(('1h',C1),('4h',C4)):
  D=load(tf)
  for K in(2,3):
    for M in (2,):
      a,o=run(D,C,K,M);out.append((tf,K,M,len(C),a,o));print(tf,'K',K,'M',M,'all',a,'oos',o,flush=True)
  for c in itertools.combinations(C[:5],3):
    a,o=run(D,list(c),2);out.append((tf,2,2,c,a,o));
json.dump(out,open('combo.json','w'))
for x in sorted(out,key=lambda x:-x[5][3])[:10]:print(x)
