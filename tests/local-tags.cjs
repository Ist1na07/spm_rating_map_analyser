const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {loadTags,filesUnder}=require('./helpers.cjs');
const root=path.resolve(__dirname,'..');
if(!process.argv[2])throw Error('Usage: node tests/local-tags.cjs <7K-dataset-folder> [candidate-git-ref]');
const candidate=process.argv[3];
const candidateSource=candidate?execFileSync('git',['show',candidate+':tag_engine.js'],{cwd:root,encoding:'utf8'}):fs.readFileSync(path.join(root,'tag_engine.js'),'utf8');
const old=loadTags(execFileSync('git',['show','1e99e4d:tag_engine.js'],{cwd:root,encoding:'utf8'})),now=loadTags(candidateSource);
const report={charts:0,chartsWithChangedLocalTag:0,coveredMs:0,changedMs:0,envelopeDifferenceMs:0,transitions:{},failures:[]};
for(const file of filesUnder(process.argv[2])){
 try{
 const text=fs.readFileSync(file,'utf8'),a=old.analyzeMap(text),b=now.analyzeMap(text),start=b.map.firstNote,end=b.map.lastNote;
 const grid=[...new Set([start,end,...a.segments.flatMap(s=>[s.start,s.end]),...b.segments.flatMap(s=>[s.start,s.end])].map(t=>Math.max(start,Math.min(end,t))))].sort((x,y)=>x-y);
 let changed=0,i=0,j=0;
 for(let k=0;k<grid.length-1;k++){
  const t=(grid[k]+grid[k+1])/2,dt=grid[k+1]-grid[k];while(i+1<a.segments.length&&a.segments[i].end<=t)i++;while(j+1<b.segments.length&&b.segments[j].end<=t)j++;
  const x=a.segments[i],y=b.segments[j];if(!x||!y||!(x.start<=t&&t<x.end)||!(y.start<=t&&t<y.end)){report.envelopeDifferenceMs+=dt;continue;}
  report.coveredMs+=dt;if(x.tag!==y.tag){changed+=dt;const pair=x.tag+' -> '+y.tag;report.transitions[pair]=(report.transitions[pair]||0)+dt;}
 }
 report.changedMs+=changed;report.charts++;if(changed>0)report.chartsWithChangedLocalTag++;
 }catch(e){report.failures.push({file:path.basename(file),error:String(e)})}
}
report.sameLocalDurationShare=1-report.changedMs/report.coveredMs;
console.log(JSON.stringify(report,null,2));
if(report.failures.length)process.exitCode=1;
