(() => {
  'use strict';
  const NAMES = { K: '帅', A: '仕', E: '相', R: '车', H: '马', C: '炮', P: '兵' };
  const BLACK_NAMES = { K: '将', A: '士', E: '象', R: '车', H: '马', C: '炮', P: '卒' };
  const RED_FILES = '九八七六五四三二一';
  const VALUES = { K: 10000, R: 950, C: 500, H: 450, E: 200, A: 200, P: 100 };
  const $ = id => document.getElementById(id);
  const boardEl = $('board');
  const state = { board: [], turn: 'r', mode: 'ai', selected: null, legal: [], history: [], last: null, timerOn: true, seconds: { r: 600, b: 600 }, clockOn: false, busy: false, ended: false, tool: null, toolSide: 'r', erase: false, toastTimer: null, gameId: 0, engineWorker: null, enginePromise: null, engineReady: false, engineError: null, engineDiagnostic: '', engineHandshake: false, engineBestmove: null, engineFailure: null, engineInfo: null };
  let timerId = null;

  function emptyBoard() { return Array.from({ length: 10 }, () => Array(9).fill(null)); }
  function initialBoard() {
    const b = emptyBoard(), back = ['R','H','E','A','K','A','E','H','R'];
    for (let x=0;x<9;x++) { b[0][x]={side:'b',type:back[x]}; b[9][x]={side:'r',type:back[x]}; }
    for (const x of [1,7]) { b[2][x]={side:'b',type:'C'}; b[7][x]={side:'r',type:'C'}; }
    for (const x of [0,2,4,6,8]) { b[3][x]={side:'b',type:'P'}; b[6][x]={side:'r',type:'P'}; }
    return b;
  }
  function clone(b) { return b.map(row => row.map(p => p ? {...p} : null)); }
  function inBounds(x,y) { return x>=0&&x<9&&y>=0&&y<10; }
  function palace(side,x,y) { return x>=3&&x<=5&&(side==='r'?y>=7&&y<=9:y>=0&&y<=2); }
  function pieceText(p) { return p.side==='r'?NAMES[p.type]:BLACK_NAMES[p.type]; }
  function sideName(s) { return s==='r'?'红':'黑'; }
  function displayFile(side,x) { return side==='r'?RED_FILES[x]:String(9-x); }
  function findKing(b, side) { for(let y=0;y<10;y++) for(let x=0;x<9;x++) if(b[y][x]?.side===side&&b[y][x].type==='K') return {x,y}; return null; }
  function pseudoMoves(b,x,y) {
    const p=b[y][x]; if(!p) return [];
    const moves=[]; const add=(tx,ty)=>{ if(inBounds(tx,ty)&&b[ty][tx]?.side!==p.side) moves.push({fx:x,fy:y,tx,ty}); };
    const ray=(dx,dy,cannon=false)=>{ let screen=false; for(let tx=x+dx,ty=y+dy;inBounds(tx,ty);tx+=dx,ty+=dy){ const q=b[ty][tx]; if(cannon){ if(!screen){if(!q)add(tx,ty);else screen=true;}else if(q){if(q.side!==p.side)add(tx,ty);break;} } else {if(!q)add(tx,ty);else {if(q.side!==p.side)add(tx,ty);break;}} } };
    if(p.type==='K'){
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const tx=x+dx,ty=y+dy; if(palace(p.side,tx,ty))add(tx,ty); }
      const dy=p.side==='r'?-1:1; for(let ty=y+dy;inBounds(x,ty);ty+=dy){if(b[ty][x]){if(b[ty][x].side!==p.side&&b[ty][x].type==='K')add(x,ty);break;}}
    } else if(p.type==='A') { for(const [dx,dy] of [[1,1],[1,-1],[-1,1],[-1,-1]]){const tx=x+dx,ty=y+dy;if(palace(p.side,tx,ty))add(tx,ty);} }
    else if(p.type==='E') { for(const [dx,dy] of [[2,2],[2,-2],[-2,2],[-2,-2]]){const tx=x+dx,ty=y+dy,eyeX=x+dx/2,eyeY=y+dy/2;if(inBounds(tx,ty)&&(p.side==='r'?ty>=5:ty<=4)&&!b[eyeY][eyeX])add(tx,ty);} }
    else if(p.type==='H') { for(const [dx,dy,lx,ly] of [[1,2,0,1],[-1,2,0,1],[1,-2,0,-1],[-1,-2,0,-1],[2,1,1,0],[2,-1,1,0],[-2,1,-1,0],[-2,-1,-1,0]]){const tx=x+dx,ty=y+dy;if(inBounds(tx,ty)&&!b[y+ly][x+lx])add(tx,ty);} }
    else if(p.type==='R') { for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])ray(dx,dy); }
    else if(p.type==='C') { for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])ray(dx,dy,true); }
    else if(p.type==='P') { const dy=p.side==='r'?-1:1; add(x,y+dy); if(p.side==='r'?y<=4:y>=5){add(x+1,y);add(x-1,y);} }
    return moves;
  }
  function attacked(b,x,y,bySide) {
    for(let yy=0;yy<10;yy++)for(let xx=0;xx<9;xx++)if(b[yy][xx]?.side===bySide){if(pseudoMoves(b,xx,yy).some(m=>m.tx===x&&m.ty===y))return true;}
    return false;
  }
  function inCheck(b,side) { const k=findKing(b,side); return !!k&&attacked(b,k.x,k.y,side==='r'?'b':'r'); }
  function apply(b,m) { const q=b[m.fy][m.fx]; b[m.ty][m.tx]=q;b[m.fy][m.fx]=null;return q; }
  function legalMoves(b,side) {
    const out=[];for(let y=0;y<10;y++)for(let x=0;x<9;x++)if(b[y][x]?.side===side)for(const m of pseudoMoves(b,x,y)){const next=clone(b);apply(next,m);if(findKing(next,side)&&!inCheck(next,side))out.push(m);}return out;
  }
  function notation(b,m,p,captured) {
    const file=displayFile(p.side,m.fx), dest=displayFile(p.side,m.tx); let action, value;
    if(m.fy===m.ty){action='平';value=dest;} else {
      const forward=p.side==='r'?m.ty<m.fy:m.ty>m.fy; action=forward?'进':'退';
      value=['H','E','A'].includes(p.type)?dest:String(Math.abs(m.ty-m.fy));
    }
    return `${pieceText(p)}${file}${action}${value}`;
  }
  function createMove(from,to,free=false) {
    const p=state.board[from.y][from.x];if(!p)return false;
    if(!free&&!legalMoves(state.board,state.turn).some(m=>m.fx===from.x&&m.fy===from.y&&m.tx===to.x&&m.ty===to.y))return false;
    const captured=state.board[to.y][to.x]; const n=notation(state.board,{fx:from.x,fy:from.y,tx:to.x,ty:to.y},p,captured);
    const old=clone(state.board); apply(state.board,{fx:from.x,fy:from.y,tx:to.x,ty:to.y});
    const record={kind:'move',before:old,after:clone(state.board),side:p.side,note:n,captured,from,to,thought:null};
    state.history.push(record);state.last={from,to};state.selected=null;state.legal=[];
    if(state.mode==='ai'){state.turn=state.turn==='r'?'b':'r';state.clockOn=true;} else { state.turn=p.side==='r'?'b':'r'; }
    if(state.mode==='ai'&&state.turn==='b'&&!state.ended) window.setTimeout(aiTurn,80);
    settlePosition();render();return true;
  }
  function placeTool(x,y) {
    const before=clone(state.board); let after;
    if(state.erase){state.board[y][x]=null;after={kind:'edit',before,after:clone(state.board),side:state.toolSide,note:`擦除（${x+1},${y+1}）`};}
    else { const p=state.board[y][x];state.board[y][x]={side:state.toolSide,type:state.tool||'P'};after={kind:'edit',before,after:clone(state.board),side:state.toolSide,note:`放置${pieceText(state.board[y][x])}（${x+1},${y+1}）`}; }
    state.history.push(after);state.last=null;state.selected=null;state.legal=[];render();
  }
  function renderBoard() {
    boardEl.innerHTML='';
    for(let y=0;y<10;y++)for(let x=0;x<9;x++){
      const cell=document.createElement('div');cell.className='board-cell';cell.dataset.x=x;cell.dataset.y=y;cell.setAttribute('role','gridcell');
      if(state.selected?.x===x&&state.selected?.y===y)cell.classList.add('selected');
      if(state.legal.some(m=>m.tx===x&&m.ty===y))cell.classList.add('legal');
      if(state.last?.from.x===x&&state.last?.from.y===y)cell.classList.add('last-from');if(state.last?.to.x===x&&state.last?.to.y===y)cell.classList.add('last-to');
      const p=state.board[y][x]; if(p){const piece=document.createElement('div');piece.className=`piece ${p.side==='r'?'red':'black'}`;piece.textContent=pieceText(p);piece.draggable=state.mode==='free'||p.side===state.turn&&!state.busy&&!state.ended;piece.setAttribute('aria-label',`${sideName(p.side)}${pieceText(p)}`);piece.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain',`${x},${y}`);state.selected={x,y};if(state.mode==='ai'&&p.side===state.turn)state.legal=legalMoves(state.board,state.turn).filter(m=>m.fx===x&&m.fy===y);});piece.addEventListener('dragend',()=>{state.selected=null;state.legal=[];render();});cell.appendChild(piece);}
      cell.addEventListener('click',()=>onCell(x,y));cell.addEventListener('dragover',e=>e.preventDefault());cell.addEventListener('drop',e=>{e.preventDefault();const [fx,fy]=(e.dataTransfer.getData('text/plain')||'').split(',').map(Number);if(Number.isInteger(fx)&&Number.isInteger(fy)){if(state.mode==='free')createMove({x:fx,y:fy},{x,y},true);else createMove({x:fx,y:fy},{x,y});}});boardEl.appendChild(cell);
    }
    const palace=document.createElementNS('http://www.w3.org/2000/svg','svg');palace.setAttribute('viewBox','0 0 900 1000');palace.setAttribute('preserveAspectRatio','none');palace.setAttribute('class','palace-lines');let lines='';for(let y=50;y<=950;y+=100)lines+=`M50 ${y}H850`;lines+='M50 50V950M850 50V950';for(let x=150;x<=750;x+=100)lines+=`M${x} 50V450M${x} 550V950`;palace.innerHTML=`<path d="${lines}M350 50L550 250M550 50L350 250M350 750L550 950M550 750L350 950"/>`;
    const l=document.createElement('span');l.className='river-label river-left';l.textContent='楚河';const r=document.createElement('span');r.className='river-label river-right';r.textContent='汉界';boardEl.append(palace,l,r);
  }
  function onCell(x,y) {
    if(state.busy||state.ended)return;
    if(state.mode==='free'&&state.tool){placeTool(x,y);return;}
    if(state.mode==='ai'&&state.turn!=='r'){return;}
    const p=state.board[y][x];
    if(state.selected){const {x:sx,y:sy}=state.selected;if(sx===x&&sy===y){state.selected=null;state.legal=[];render();return;}
      const valid=state.mode==='free'||state.legal.some(m=>m.tx===x&&m.ty===y);
      if(valid){createMove({x:sx,y:sy},{x,y},state.mode==='free');return;}
    }
    if(p&&(state.mode==='free'||p.side===state.turn)){state.selected={x,y};state.legal=state.mode==='free'?[]:legalMoves(state.board,state.turn).filter(m=>m.fx===x&&m.fy===y);}else{state.selected=null;state.legal=[];}render();
  }
  function settlePosition() {
    if(state.mode!=='ai')return;
    const moves=legalMoves(state.board,state.turn);
    if(!moves.length){state.ended=true;state.clockOn=false;toast(inCheck(state.board,state.turn)?`${sideName(state.turn==='r'?'b':'r')}方获胜，${sideName(state.turn)}方被将死`:`${sideName(state.turn)}方无棋可走，对局结束`);}
  }
  function renderHistory() {
    const list=$('historyList');list.innerHTML='';$('moveCount').textContent=`共 ${state.history.length} 手`;
    if(!state.history.length){list.innerHTML='<div class="empty-state"><span>卿</span><p>棋局尚未开始</p><small>走出的每一步都会记录在这里</small></div>';return;}
    for(let i=0;i<state.history.length;i+=2){const row=document.createElement('div');row.className='move-row';const no=document.createElement('span');no.className='move-no';no.textContent=String(i/2+1).padStart(2,'0');row.append(no);for(let j=i;j<i+2;j++){const r=state.history[j],cell=document.createElement('span');cell.className='move-cell'+(j===state.history.length-1?' current':'');cell.textContent=r?`${r.note}${r.captured?' ×':''}`:'·';row.append(cell);}list.append(row);}
    list.scrollTop=list.scrollHeight;
  }
  function render() {
    renderBoard();renderHistory();$('turnIndicator').innerHTML=`<span class="turn-dot" style="background:${state.turn==='r'?'#b94e37':'#303b32'}"></span><span>${state.ended?'对局结束':`${sideName(state.turn)}方行棋`}</span>`;
    $('statusText').textContent=state.mode==='free'?'自由摆棋 · 点击棋子移动或使用摆子工具':state.ended?'本局已结束':state.busy?'AI 正在思考…':state.turn==='r'?'轮到你行棋':'AI 思考中';
    $('blackName').textContent=state.mode==='free'?'自由摆棋':engineLabel();$('redName').textContent=state.mode==='free'?'自由摆棋':'你';
    renderClocks();
  }
  function renderClocks(){for(const s of ['r','b']){$(`${s==='r'?'red':'black'}Clock`).textContent=state.timerOn?formatTime(state.seconds[s]):'∞';$(`${s==='r'?'red':'black'}Clock`).classList.toggle('flagged',state.seconds[s]<=0&&state.timerOn);}}
  function formatTime(n){n=Math.max(0,n);return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;}
  function startTimer(){if(timerId)clearInterval(timerId);timerId=setInterval(()=>{if(!state.timerOn||!state.clockOn||state.ended)return;state.seconds[state.turn]--;if(state.seconds[state.turn]<=0){state.seconds[state.turn]=0;state.ended=true;state.clockOn=false;toast(`${sideName(state.turn==='r'?'b':'r')}方胜：${sideName(state.turn)}方超时`);}renderClocks();},1000);}
  function toast(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(state.toastTimer);state.toastTimer=setTimeout(()=>el.classList.remove('show'),2300);}
  function compactBoard(b){const alphabet='0123456789abcde',types=['K','A','E','R','H','C','P'];return b.flat().map(p=>p?alphabet[types.indexOf(p.type)+(p.side==='r'?1:8)]:'0').join('');}
  function replayCode(){const start=state.history.length?state.history[0].before:state.board;const events=state.history.map(r=>{const before=compactBoard(r.before),after=compactBoard(r.after),changes=[];for(let i=0;i<90;i++)if(before[i]!==after[i])changes.push(i,after[i]);const engine=r.engineInfo?{n:r.engineInfo.name,d:r.engineInfo.depth,c:r.engineInfo.scoreCp,m:r.engineInfo.mate,p:r.engineInfo.pv}:null;return[r.kind==='move'?'m':'e',r.side,r.note,changes,r.thought||'',engine];});const payload={v:1,m:state.mode==='ai'?'a':'f',t:state.turn,s:compactBoard(start),e:events,f:compactBoard(state.board)};let binary='';const bytes=new TextEncoder().encode(JSON.stringify(payload));for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return`XQ1:${btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}`;}
  async function copyReplay(){const code=replayCode();try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(code);}else throw new Error('Clipboard API unavailable');toast('复盘码已复制，可以粘贴到聊天里分析');}catch{const box=document.createElement('textarea');box.value=code;box.setAttribute('readonly','');box.style.position='fixed';box.style.opacity='0';document.body.append(box);box.select();let copied=false;try{copied=document.execCommand('copy');}catch{}box.remove();if(copied)toast('复盘码已复制，可以粘贴到聊天里分析');else window.prompt('复制下面的棋局复盘码',code);}}
  function material(b){let score=0;for(let y=0;y<10;y++)for(let x=0;x<9;x++){const p=b[y][x];if(p){let v=VALUES[p.type];if(p.type==='P')v+=p.side==='r'?(y<=4?45:Math.max(0,4-y)*10):(y>=5?45:Math.max(0,y-5)*10);score+=(p.side==='b'?v:-v);}}return score;}
  function evaluate(b,side){const m=material(b);return side==='b'?m:-m;}
  function search(b,side,depth,alpha,beta,ply=0){const moves=legalMoves(b,side);if(!moves.length)return inCheck(b,side)?-100000+ply:0;if(depth===0)return evaluate(b,side);moves.sort((a,c)=>((b[c.ty][c.tx]?VALUES[b[c.ty][c.tx].type]:0)-(b[a.ty][a.tx]?VALUES[b[a.ty][a.tx].type]:0)));let best=-Infinity;for(const m of moves){const next=clone(b);apply(next,m);const score=-search(next,side==='r'?'b':'r',depth-1,-beta,-alpha,ply+1);best=Math.max(best,score);alpha=Math.max(alpha,score);if(alpha>=beta)break;}return best;}
  function explainMove(b,m,p,captured,wasCheck,score){const bits=[];if(captured)bits.push(`这步吃掉了对方的${pieceText(captured)}，子力交换有利`);if(wasCheck)bits.push('这步形成将军，迫使对手优先应对帅/将的安全');if(m.tx>=2&&m.tx<=6&&m.ty>=3&&m.ty<=6)bits.push('落点靠近河界与中路，便于扩大活动空间');if(p.type==='P'&&(p.side==='b'?m.ty>=5:m.ty<=4))bits.push('兵卒已过河，开始具备横向控制能力');if(!bits.length)bits.push(`${pieceText(p)}走到${displayFile(p.side,m.tx)}路，兼顾棋子活动与阵形安全`);if(score!==undefined)bits.push(`浅层局面评估约 ${Math.round(score)} 分（仅供参考）`);return `选择${notation(b,m,p,captured)}：${bits.join('；')}。`}
  function engineLabel(){if(state.engineError)return'本地备用 AI';if(state.engineReady)return'Pikafish 强力引擎';if(state.enginePromise)return'Pikafish 正在加载';return'AI 引擎待启动';}
  function engineStatus(message){$('engineStatus').textContent=`Pikafish：${message}`;$('blackName').textContent=state.mode==='free'?'自由摆棋':engineLabel();}
  function boardFen(b,side){const fenRows=b.map(row=>{let out='',empty=0;for(const p of row){if(!p){empty++;continue;}if(empty){out+=empty;empty=0;}const code={K:'k',A:'a',E:'b',R:'r',H:'n',C:'c',P:'p'}[p.type];out+=p.side==='r'?code.toUpperCase():code;}if(empty)out+=empty;return out;});return`${fenRows.join('/')} ${side==='r'?'w':'b'} - - 0 1`;}
  function parseUciMove(text){const match=/^([a-i])([0-9])([a-i])([0-9])$/i.exec(text||'');if(!match)return null;return{fx:match[1].toLowerCase().charCodeAt(0)-97,fy:9-Number(match[2]),tx:match[3].toLowerCase().charCodeAt(0)-97,ty:9-Number(match[4])};}
  function failEngine(error,reject){state.engineError=error instanceof Error?error.message:String(error);state.engineReady=false;state.enginePromise=null;state.engineBestmove=null;state.engineFailure=null;const worker=state.engineWorker;state.engineWorker=null;if(worker)worker.terminate();engineStatus(`不可用：${state.engineError}`);if(reject)reject(error);}
  function startPikafish(){
    if(state.engineReady)return Promise.resolve(true);
    if(state.enginePromise)return state.enginePromise;
    if(!window.Worker||!window.crossOriginIsolated){const error=new Error('需要通过 serve.py 启动跨源隔离本地服务');failEngine(error);return Promise.reject(error);}
    state.engineError=null;engineStatus('启动中，载入匹配版本的棋力网络');
    state.enginePromise=new Promise((resolve,reject)=>{
      let done=false;
      const worker=new Worker(new URL('engine/worker.js',location.href));
      state.engineWorker=worker;
      const finish=(ok,error)=>{if(done)return;done=true;if(!ok)failEngine(error,reject);};
      const failSearch=error=>{const failure=error instanceof Error?error:new Error(String(error));state.engineReady=false;state.enginePromise=null;state.engineBestmove=null;const active=state.engineWorker;state.engineWorker=null;if(active)active.terminate();if(state.engineFailure){const rejectSearch=state.engineFailure;state.engineFailure=null;rejectSearch(failure);}engineStatus(`搜索失败 · ${failure.message}`);};
      worker.onerror=e=>{const error=new Error(e.message||'引擎工作线程启动失败');if(!state.engineReady)finish(false,error);else failSearch(error);};
      worker.onmessage=e=>{
        const data=e.data||{};
        if(data.type==='stderr'){state.engineDiagnostic=String(data.line||'');return;}
        if(data.type==='error'){const error=new Error(data.error||'搜索失败');if(!state.engineReady)finish(false,error);else failSearch(error);return;}
        if(data.type==='net-progress'){engineStatus(`正在载入棋力网络 ${data.total?Math.floor(data.loaded/data.total*100):0}%`);return;}
        if(data.type==='ready'){worker.postMessage({type:'command',command:'uci'});return;}
        if(data.type!=='line')return;
        const line=String(data.line||'');
        if(line.includes('CRITICAL ERROR')){const error=new Error(line);if(!state.engineReady)finish(false,error);else failSearch(error);return;}
        if(line==='uciok'){state.engineHandshake=true;worker.postMessage({type:'command',command:'setoption name Threads value 4'});worker.postMessage({type:'command',command:'setoption name Hash value 128'});worker.postMessage({type:'command',command:'isready'});return;}
        if(line==='readyok'&&state.engineHandshake&&!state.engineReady){state.engineReady=true;state.engineError=null;state.enginePromise=null;engineStatus('就绪 · Pikafish 强力引擎');done=true;resolve(true);return;}
        if(line.startsWith('info ')){const depth=Number(/\bdepth (\d+)/.exec(line)?.[1]||0),cp=Number(/\bscore cp (-?\d+)/.exec(line)?.[1]),mate=Number(/\bscore mate (-?\d+)/.exec(line)?.[1]);const pv=line.match(/\bpv (.+)$/)?.[1]||'';state.engineInfo={depth,scoreCp:Number.isFinite(cp)?cp:null,mate:Number.isFinite(mate)?mate:null,pv};if(state.busy)engineStatus(`搜索中 · 深度 ${depth}`);return;}
        if(line.startsWith('bestmove ')){const move=line.split(/\s+/)[1];if(state.engineBestmove){const resolveMove=state.engineBestmove;state.engineBestmove=null;state.engineFailure=null;resolveMove({move,info:state.engineInfo});}}
      };
      worker.postMessage({type:'init'});
    });
    return state.enginePromise;
  }
  function searchWithPikafish(gameId){return startPikafish().then(()=>{if(gameId!==state.gameId||!state.busy)return null;return new Promise((resolve,reject)=>{state.engineBestmove=resolve;state.engineFailure=reject;state.engineInfo=null;state.engineDiagnostic='';state.engineStartedAt=Date.now();state.engineWorker.postMessage({type:'command',command:`position fen ${boardFen(state.board,state.turn)}`});state.engineWorker.postMessage({type:'command',command:'go movetime 1800'});setTimeout(()=>{if(state.engineBestmove===resolve){const detail=state.engineDiagnostic?`：${state.engineDiagnostic}`:'';failEngine(new Error(`Pikafish 搜索超时${detail}`),reject);}},12000);});});}
  function pvChinese(before,pv){const pos=clone(before),out=[];let side='b';for(const token of (pv||'').split(/\s+/).slice(0,6)){const m=parseUciMove(token);if(!m)break;const p=pos[m.fy]?.[m.fx];if(!p||p.side!==side)break;const legal=legalMoves(pos,side).find(x=>x.fx===m.fx&&x.fy===m.fy&&x.tx===m.tx&&x.ty===m.ty);if(!legal)break;const captured=pos[m.ty][m.tx];out.push(notation(pos,m,p,captured));apply(pos,m);side=side==='r'?'b':'r';}return out.join(' ');}
  function engineThought(before,m,p,captured,givesCheck,info){const facts=[];if(captured)facts.push(`吃掉${pieceText(captured)}`);if(givesCheck)facts.push('形成将军');const line=pvChinese(before,info?.pv);const score=info?.mate!==null&&info?.mate!==undefined?`将杀距离 ${info.mate} 手`:`评估 ${info?.scoreCp===null||info?.scoreCp===undefined?'未知':`${info.scoreCp>0?'+':''}${info.scoreCp} cp`}`;return`Pikafish 选择${notation(before,m,p,captured)}，搜索深度 ${info?.depth||'未知'}，${score}。${facts.length?`棋步特点：${facts.join('、')}。`:''}${line?`引擎主变化：${line}。`:''}评估和主线来自引擎；棋理解释可结合复盘码再核验。`;}
  function finishAIMove(m,info,gameId){if(gameId!==state.gameId||!state.busy)return;const before=clone(state.board),p=before[m.fy][m.fx],captured=before[m.ty][m.tx];if(!p||p.side!=='b'){state.busy=false;render();return;}apply(state.board,m);const givesCheck=inCheck(state.board,'r'),note=notation(before,m,p,captured),engineInfo=info?{name:'Pikafish',depth:info.depth||0,scoreCp:info.scoreCp,mate:info.mate,pv:info.pv||''}:null;if(info){state.engineError=null;engineStatus('就绪 · Pikafish 强力引擎');}const rec={kind:'move',before,after:clone(state.board),side:'b',note,captured,from:{x:m.fx,y:m.fy},to:{x:m.tx,y:m.ty},thought:info?engineThought(before,m,p,captured,givesCheck,info):explainMove(before,m,p,captured,givesCheck,undefined),engineInfo};state.history.push(rec);state.last={from:rec.from,to:rec.to};$('thoughtText').textContent=rec.thought;state.turn='r';state.busy=false;settlePosition();render();}
  function fallbackSearchMove(gameId){setTimeout(()=>{if(gameId!==state.gameId||!state.busy)return;const moves=legalMoves(state.board,'b');if(!moves.length){state.busy=false;settlePosition();render();return;}let best=-Infinity,candidates=[];for(const m of moves){const next=clone(state.board),captured=next[m.ty][m.tx],p={...next[m.fy][m.fx]};apply(next,m);const score=-search(next,'r',2,-Infinity,Infinity,1);if(score>best){best=score;candidates=[{m,score,captured,p}];}else if(score===best)candidates.push({m,score,captured,p});}const choice=candidates[Math.floor(Math.random()*Math.min(candidates.length,2))];finishAIMove(choice.m,null,gameId);},30);}
  async function aiTurn(){if(state.mode!=='ai'||state.turn!=='b'||state.ended)return;state.busy=true;const gameId=state.gameId;render();try{const result=await searchWithPikafish(gameId);if(!result||gameId!==state.gameId||!state.busy)return;const m=parseUciMove(result.move);if(!m||!legalMoves(state.board,'b').some(q=>q.fx===m.fx&&q.fy===m.fy&&q.tx===m.tx&&q.ty===m.ty))throw new Error(`引擎返回了无法识别的走法：${result.move}`);finishAIMove(m,result.info,gameId);}catch(error){if(gameId!==state.gameId||!state.busy)return;state.engineError=error.message||String(error);engineStatus(`改用本地备用搜索 · ${state.engineError}`);toast('Pikafish 暂不可用，当前使用较弱的本地备用 AI');fallbackSearchMove(gameId);}}
  function resetSearchGeneration(){state.gameId++;if(state.engineWorker&&state.engineReady)state.engineWorker.postMessage({type:'command',command:'stop'});}
  function newGame(){resetSearchGeneration();state.board=initialBoard();state.turn='r';state.mode='ai';state.selected=null;state.legal=[];state.history=[];state.last=null;state.busy=false;state.ended=false;state.clockOn=true;state.seconds={r:Number($('timeControl').value),b:Number($('timeControl').value)};state.tool=null;state.erase=false;$('aiMode').classList.add('active');$('freeMode').classList.remove('active');$('freeTools').classList.remove('visible');$('thoughtText').textContent='AI 落子后，这里会显示引擎评估和主线；复制复盘码后也能在聊天中深入分析。';buildPalette();render();}
  function setMode(mode){if(state.mode===mode)return;resetSearchGeneration();state.mode=mode;state.board=initialBoard();state.turn='r';state.selected=null;state.legal=[];state.history=[];state.last=null;state.busy=false;state.ended=false;state.clockOn=true;state.seconds={r:Number($('timeControl').value),b:Number($('timeControl').value)};$('aiMode').classList.toggle('active',mode==='ai');$('freeMode').classList.toggle('active',mode==='free');$('freeTools').classList.toggle('visible',mode==='free');$('thoughtText').textContent=mode==='free'?'自由模式允许双方摆子、移动与清理棋盘；所有操作都会写入当前棋谱。':'AI 落子后，这里会显示引擎评估和主线；复制复盘码后也能在聊天中深入分析。';render();}
  function buildPalette(){const el=$('palette');el.innerHTML='';const sides=document.createElement('div');sides.className='palette-side';for(const [s,label] of [['r','红方'],['b','黑方']]){const btn=document.createElement('button');btn.textContent=label;btn.classList.toggle('active',state.toolSide===s);btn.onclick=()=>{state.toolSide=s;state.tool=null;state.erase=false;buildPalette();};sides.append(btn);}el.append(sides);for(const t of ['K','A','E','R','H','C','P']){const btn=document.createElement('button');btn.className='palette-piece'+(state.tool===t&&!state.erase?' active':'');btn.textContent=state.toolSide==='r'?NAMES[t]:BLACK_NAMES[t];btn.title=`放置${btn.textContent}`;btn.onclick=()=>{state.tool=t;state.erase=false;buildPalette();};el.append(btn);}}
  function undo(){if(state.busy||!state.history.length)return;let count=state.mode==='ai'&&state.history.length>=2?2:1;while(count--&&state.history.length){const r=state.history.pop();state.board=clone(r.before);state.last=null;state.turn=r.side;state.ended=false;}state.clockOn=state.history.length>0&&state.mode==='ai';const lastAI=[...state.history].reverse().find(r=>r.side==='b'&&r.thought);$('thoughtText').textContent=lastAI?.thought||'AI 落子后，这里会记录它选择这一步的主要依据，方便你随时追问和复盘。';render();}
  $('themeToggle').addEventListener('click',()=>{const dark=document.documentElement.dataset.theme==='dark',next=dark?'light':'dark';document.documentElement.dataset.theme=next;$('themeGlyph').textContent=next==='dark'?'☼':'☾';$('themeLabel').textContent=next==='dark'?'浅色':'深色';$('themeToggle').setAttribute('aria-pressed',String(next==='dark'));$('themeToggle').setAttribute('aria-label',`切换到${next==='dark'?'浅色':'深色'}主题`);$('themeToggle').title=`切换到${next==='dark'?'浅色':'深色'}主题`;});
  $('copyReplay').addEventListener('click',copyReplay);
  $('newGame').addEventListener('click',newGame);$('aiMode').addEventListener('click',()=>setMode('ai'));$('freeMode').addEventListener('click',()=>setMode('free'));$('undoBtn').addEventListener('click',undo);$('timerToggle').addEventListener('change',e=>{state.timerOn=e.target.checked;$('timerConfig').style.opacity=state.timerOn?'1':'.45';renderClocks();});$('timeControl').addEventListener('change',()=>{state.seconds={r:Number($('timeControl').value),b:Number($('timeControl').value)};renderClocks();});$('eraseTool').addEventListener('click',()=>{state.erase=true;state.tool=null;buildPalette();});$('clearBoard').addEventListener('click',()=>{const before=clone(state.board);state.board=emptyBoard();state.history.push({kind:'edit',before,after:clone(state.board),side:'r',note:'清空棋盘'});state.last=null;state.selected=null;render();});
  state.board=initialBoard();state.clockOn=true;buildPalette();render();startTimer();
})();
