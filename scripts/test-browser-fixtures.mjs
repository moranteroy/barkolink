import {spawn} from 'node:child_process';
const port=process.env.BARKOLINK_BROWSER_PORT || '8127',base='http://127.0.0.1:'+port;
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',port,'--strictPort','--configLoader','native'],{stdio:'inherit',windowsHide:true});
let exited=false;server.on('exit',()=>{exited=true;});
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try {
 let ready=false;
 for(let attempt=0;attempt<60;attempt++) {
  if(exited)throw new Error('Fixture preview server exited before it was ready.');
  try{const response=await fetch(base);if(response.ok){ready=true;break;}}catch{/* startup */}
  await wait(500);
 }
 if(!ready)throw new Error('Fixture preview server did not become ready.');
 for(const name of ['verify-role-navigation-ui','verify-inbox-pagination-ui','verify-mobile-density-ui','verify-manual-voucher-ui','verify-ticket-history-ui','verify-ticket-qr-ui','verify-mobile-ticket-actions']) {
  await new Promise((resolve,reject)=>{
   const child=spawn(process.execPath,[`scripts/${name}.mjs`],{env:{...process.env,BARKOLINK_UI_URL:base},stdio:'inherit',windowsHide:true});
   child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(`${name} failed (${code}).`)));
  });
 }
}finally{server.kill();}
