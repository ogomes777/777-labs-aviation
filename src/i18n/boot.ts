import { LANG_CODES } from './langs';

/** Script inline (antes do primeiro paint): tema e idioma salvos/detectados. */
export const PREFS_BOOT = `(function(){try{var d=document.documentElement,q=new URLSearchParams(location.search);var t=q.get('theme')||localStorage.getItem('simfly:theme');d.dataset.theme=t==='night'?'night':'sky';var ok=${JSON.stringify(LANG_CODES)};var l=q.get('lang')||localStorage.getItem('simfly:lang');if(ok.indexOf(l)<0){l='pt';var n=(navigator.languages||[navigator.language||'pt']);for(var i=0;i<n.length;i++){var c=String(n[i]).slice(0,2).toLowerCase();if(ok.indexOf(c)>=0){l=c;break}}}d.dataset.lang=l}catch(e){}})();`;

