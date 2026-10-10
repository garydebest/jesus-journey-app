import net from 'node:net';
import tls from 'node:tls';
import fs from 'node:fs';

const host='aws-0-us-west-1.pooler.supabase.com',port=6543;
const report={host,port,node:process.version,commit:process.env.GITHUB_SHA,verified:false,credentialsSent:false,sqlSent:false,limitations:'GitHub runner default Node trust store; not proof of Render trust configuration, application connection settings, or authenticated DB access.'};
try {
  const result=await new Promise((resolve,reject)=>{
    const socket=net.connect({host,port});let secured,finished=false;
    const timer=setTimeout(()=>finish(new Error('TLS probe timed out')),15000);
    function finish(error,value){if(finished)return;finished=true;clearTimeout(timer);secured?.destroy();socket.destroy();error?reject(error):resolve(value);}
    socket.once('error',e=>finish(e));
    socket.once('connect',()=>{const request=Buffer.alloc(8);request.writeInt32BE(8,0);request.writeInt32BE(80877103,4);socket.write(request);});
    socket.once('data',data=>{
      if(data.length!==1||data[0]!==83)return finish(new Error('Endpoint did not accept PostgreSQL SSL negotiation'));
      secured=tls.connect({socket,servername:host,rejectUnauthorized:true});
      secured.once('error',e=>finish(e));
      secured.once('secureConnect',()=>{
        if(!secured.authorized)return finish(new Error('Certificate verification not authorized'));
        const peer=secured.getPeerCertificate();
        const hostnameError=tls.checkServerIdentity(host,peer);if(hostnameError)return finish(hostnameError);
        finish(null,{verified:true,protocol:secured.getProtocol(),cipher:secured.getCipher().name,certificate:{subject:peer.subject,issuer:peer.issuer,validFrom:peer.valid_from,validTo:peer.valid_to,fingerprint256:peer.fingerprint256,subjectAltName:peer.subjectaltname}});
      });
    });
  });
  Object.assign(report,result);
} catch(e) {
  report.error={code:e.code||'TLS_PROBE_FAILED',message:e.message};
  process.exitCode=1;
}
fs.writeFileSync('database-certificate-report.json',JSON.stringify(report,null,2));
