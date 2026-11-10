(function(){
  var body=document.body;
  var toggle=document.querySelector('.menu-toggle');
  if(toggle){toggle.addEventListener('click',function(){
    var hdr=document.querySelector('.site-header');
    var nav=document.querySelector('.main-nav');
    if(hdr&&nav){nav.style.top=hdr.getBoundingClientRect().bottom+'px';}
    var open=body.classList.toggle('nav-open');
    toggle.setAttribute('aria-expanded',open?'true':'false');
  });}
  var dds=document.querySelectorAll('.has-dd');
  function closeMenus(){
    dds.forEach(function(li){li.classList.remove('open');li.classList.add('closed');var t=li.querySelector('.dd-toggle');if(t){t.setAttribute('aria-expanded','false');}});
    if(document.activeElement&&document.activeElement.closest&&document.activeElement.closest('.has-dd')){document.activeElement.blur();}
  }
  dds.forEach(function(li){
    li.addEventListener('mouseleave',function(){li.classList.remove('closed');});
    var btn=li.querySelector('.dd-toggle');
    if(btn){btn.addEventListener('click',function(e){
      e.stopPropagation();
      var wasOpen=li.classList.contains('open');
      closeMenus();
      if(!wasOpen){li.classList.remove('closed');li.classList.add('open');btn.setAttribute('aria-expanded','true');}
    });}
  });
  document.querySelectorAll('.main-nav a').forEach(function(a){
    a.addEventListener('click',function(){closeMenus();body.classList.remove('nav-open');if(toggle){toggle.setAttribute('aria-expanded','false');}});
  });
  document.addEventListener('click',function(e){if(!e.target.closest('.has-dd')){closeMenus();}});
  document.addEventListener('keydown',function(e){
    if(e.key==='Escape'){body.classList.remove('nav-open');closeMenus();}
  });
  document.querySelectorAll('form.js-form').forEach(function(form){
    function fallback(){
      /* AJAX was refused (for example the form is not activated yet). Send it as a normal form post instead,
         which also triggers FormSubmit's one-time activation email, then return to this page. */
      try{
        var n=form.querySelector('input[name="_next"]');
        if(!n){n=document.createElement('input');n.type='hidden';n.name='_next';form.appendChild(n);}
        n.value=location.origin+location.pathname+'?sent=1';
        form.setAttribute('action',form.getAttribute('data-endpoint'));
        form.setAttribute('method','POST');
        HTMLFormElement.prototype.submit.call(form);
      }catch(err){show('error');}
    }
    function show(kind){
      form.querySelectorAll('.form-status').forEach(function(n){n.classList.toggle('show',n.getAttribute('data-status')===kind);});
      var n=form.querySelector('.form-status[data-status="'+kind+'"]');
      if(n){n.scrollIntoView({behavior:'smooth',block:'center'});}
    }
    form.addEventListener('submit',function(e){
      if(!form.checkValidity()){return;}
      var endpoint=form.getAttribute('data-endpoint');
      if(!endpoint){e.preventDefault();show('unconnected');return;}
      if(!window.fetch||!window.FormData){return;}
      e.preventDefault();
      var btn=form.querySelector('button[type="submit"]');
      var label=btn?btn.innerHTML:'';
      if(btn){btn.disabled=true;btn.textContent='Sending\u2026';}
      var types={'admission-form':'enquiry','team-form':'team','review-form':'review'};
      var fd=new FormData(form),obj={};
      fd.forEach(function(v,k){if(typeof v==='string'){obj[k]=v;}});
      /* 1) save to the admin dashboard, 2) email a copy. Either one succeeding counts as sent. */
      var saved=(types[form.id]&&/^https?:/.test(location.protocol))
        ?fetch('/api/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:types[form.id],data:obj})})
          .then(function(r){return r.ok;}).catch(function(){return false;})
        :Promise.resolve(false);
      var ajax=endpoint.replace('formsubmit.co/','formsubmit.co/ajax/');
      var emailed=fetch(ajax,{method:'POST',body:fd,headers:{'Accept':'application/json'}})
        .then(function(r){return r.json().then(function(j){return r.ok&&j&&String(j.success)==='true';});})
        .catch(function(){return false;});
      Promise.all([saved,emailed]).then(function(res){
        if(res[0]||res[1]){form.reset();show('success');}else{fallback();}
      }).then(function(){if(btn){btn.disabled=false;btn.innerHTML=label;}});
    });
  });
  if(/[?&]sent=1/.test(location.search)){
    var f0=document.querySelector('form.js-form');
    if(f0){var ok=f0.querySelector('.form-status[data-status="success"]');if(ok){ok.classList.add('show');ok.scrollIntoView({block:'center'});}}
  }
  var rg=document.getElementById('reviews-grid');
  if(rg&&window.fetch&&/^https?:/.test(location.protocol)){
    var qIcon=rg.querySelector('.q'),avIcon=rg.querySelector('.avatar');
    fetch('/api/reviews').then(function(r){return r.ok?r.json():null;}).then(function(d){return (d&&d.reviews&&d.reviews.length)?d:fetch('reviews.json',{cache:'no-store'}).then(function(r){return r.ok?r.json():null;});}).catch(function(){return fetch('reviews.json',{cache:'no-store'}).then(function(r){return r.ok?r.json():null;});}).then(function(d){
      var list=((d&&d.reviews)||[]).filter(function(r){return r&&r.published!==false&&r.name&&r.text;});
      if(!list.length||!qIcon||!avIcon){return;}
      var qh=qIcon.outerHTML,ah=avIcon.outerHTML;rg.innerHTML='';
      list.forEach(function(r){
        var a=document.createElement('article');a.className='card testimonial';a.innerHTML=qh+'<p></p><div class="who">'+ah+'<div><strong></strong><br><span class="small"></span></div></div>';
        a.querySelector('p').textContent=r.text;a.querySelector('strong').textContent=r.name;
        a.querySelector('.small').textContent=(r.course||'')+(r.course&&r.role?' \u00b7 ':'')+(r.role||'');
        rg.appendChild(a);
      });
    }).catch(function(){});
  }
  var y=document.getElementById('year');if(y){y.textContent=new Date().getFullYear();}
})();
