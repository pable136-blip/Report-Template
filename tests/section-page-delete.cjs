const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
for (const ext of ['.ts', '.tsx']) {
  require.extensions[ext] = (module, filename) => {
    const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true},
    }).outputText;
    module._compile(output, filename);
  };
}

const {deleteSectionPage}=require('../lib/section-pages.ts');
const removed=deleteSectionPage('첫째\f둘째\f셋째',[{id:'a',name:'a',page:0},{id:'b',name:'b',page:1},{id:'c',name:'c',page:2}],1);
assert.equal(removed.body,'첫째\f셋째');
assert.deepEqual(removed.images.map(i=>[i.id,i.page]),[['a',0],['c',1]]);
assert.equal(deleteSectionPage('본문\f',[],1).body,'본문');
assert.throws(()=>deleteSectionPage('기본',[],0));
console.log('PASS: page deletion, image renumbering, blank page removal and minimum page protection');
const {deleteVisibleSectionPage,sectionPageSlides}=require('../lib/section-pages.ts');
const longBody='가'.repeat(900);
const auto=sectionPageSlides(longBody,[],32,1.5);
assert.ok(auto.length>1);
const autoDeleted=deleteVisibleSectionPage(longBody,[],auto[1],32,1.5);
assert.equal(autoDeleted.body,longBody.slice(0,auto[1].bodyRange.start)+longBody.slice(auto[1].bodyRange.end));
const imgs=[{id:'one',name:'one',layout:'separate'},{id:'two',name:'two',layout:'separate'}];
const imageSlide=sectionPageSlides('유지할 본문',imgs,32,1.5).find(p=>p.image?.id==='one');
assert.deepEqual(deleteVisibleSectionPage('유지할 본문',imgs,imageSlide,32,1.5),{body:'유지할 본문',images:[imgs[1]]});
assert.equal(deleteVisibleSectionPage('마지막',[],sectionPageSlides('마지막',[],32)[0],32,1.5).body,'');
console.log('PASS: automatic overflow, separate image slide, and final content page deletion');
const overviewText='○ 기 간 : 2026. 9. ~2026. 11. / 3개월\n\n○ 대 상 : 공무원 500명\n\n○ 장 소 : 한국기술교육대학교 제2캠퍼스\n\n○ 내 용 : 전문·실습 중심의 공무원 AI 역량강화';
const fitted=sectionPageSlides(overviewText,[],32,1.5,true);
assert.equal(fitted.length,1);
const mixed='○ 사업 2026년 교육 현황 ABC 500명\n'.repeat(60);
const widePages=sectionPageSlides(mixed,[],32,1.5,false);
assert.equal(widePages.map(p=>p.body).join(''),mixed);
assert.ok(sectionPageSlides('가'.repeat(400),[],32,1.5,false).length<=sectionPageSlides('가'.repeat(400),[],32,1.5,true).length);
console.log('PASS: mixed-width text fits available space and pagination preserves source');
