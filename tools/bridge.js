// Preview-only Chrome API bridge. Never included in the installable extension.
(() => {
 const listeners=[];const scenario=new URLSearchParams(location.search).get('scenario')||'populated';
 const url='https://www.paulgraham.com/makersschedule.html';
 const posts=[{id:'hn:1',source:'hn',title:'Maker’s Schedule, Manager’s Schedule',community:'Hacker News',href:'https://news.ycombinator.com/item?id=1',comments:238,score:642,created:1754000000},{id:'reddit:abc',source:'reddit',title:'Why meetings cost more than an hour of your time',community:'r/programming',href:'https://www.reddit.com/comments/abc/',comments:86,score:391,created:1755000000},{id:'hn:2',source:'hn',title:'The difference between making and managing',community:'Hacker News',href:'https://news.ycombinator.com/item?id=2',comments:42,score:128,created:1756000000}];
 let state={tabId:1,url,status:'ready',entry:{url,posts,sources:{reddit:{state:'ok',posts:posts.filter(p=>p.source==='reddit')},hn:{state:'ok',posts:posts.filter(p=>p.source==='hn')}},checked:Date.now()}};
 if(scenario==='empty') {state.entry.posts=[];state.entry.sources={reddit:{state:'ok',posts:[]},hn:{state:'ok',posts:[]}};}
 if(scenario==='partial'){state.entry.posts=posts.filter(p=>p.source==='hn');state.entry.sources.reddit={state:'blocked',posts:[]};}
 if(scenario==='loading'){state.status='loading';state.entry=null;}
 if(scenario==='private')state={tabId:1,url:null,status:'unsupported',entry:null};
 if(scenario==='long')state.entry.posts=[{...posts[0],title:'<img src=x onerror=alert(1)> '+ 'A very long title about schedules and interruptions '.repeat(7)}];
 if(scenario==='many')state.entry.posts=Array.from({length:200},(_,i)=>({...posts[i%3],id:'hn:'+i,title:`Discussion ${i+1}: ${posts[i%3].title}`}));
 const ready=Promise.resolve();
 window.chrome={runtime:{id:'preview-only',onMessage:{addListener(fn){listeners.push(fn);}},async sendMessage(message){await ready;if(message.type==='setPaused')state={...state,status:message.paused?'paused':'ready',paused:message.paused};return structuredClone(state);}}};
})();
