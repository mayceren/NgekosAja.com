(function (A, N) {
  'use strict';
  const B = window.NB = {services: {}, cache: new Map(), pending: new Map(), revision: 0};
  B.integer = value => {
    if (typeof value === 'number' && !Number.isSafeInteger(value)) throw new Error('Nominal di luar presisi aman.');
    if (!/^-?\d+$/.test(String(value))) throw new Error('Nominal harus berupa rupiah bulat.');
    return BigInt(value);
  };
  B.money = value => new Intl.NumberFormat('id-ID', {style:'currency', currency:'IDR', maximumFractionDigits:0}).format(B.integer(value ?? '0'));
  B.today = () => new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Jakarta', year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  B.date = value => value ? new Intl.DateTimeFormat('id-ID', {timeZone:'Asia/Jakarta', day:'numeric',month:'short',year:'numeric'}).format(new Date(value.length===10 ? value+'T12:00:00+07:00' : value)) : '—';
  B.image = path => /^assets\/images\/(room-([1-9]|1[0-2])|kitchen|bathroom)\.jpg$/.test(path || '') ? path : 'assets/images/room-2.jpg';
  // Preserve integral JSON tokens before the SDK's JSON.parse can round bigint/numeric.
  // Strings (including escaped quotes) are consumed as complete tokens.
  B.losslessJSON = text => text.replace(/"(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g, token => {
    if (token[0]==='"') return token;
    if (/^-?\d+$/.test(token) && (BigInt(token)>9007199254740991n || BigInt(token)<-9007199254740991n)) return '"'+token+'"';
    if (/^-?\d+\.0+$/.test(token)) return '"'+token.split('.')[0]+'"';
    return token;
  });
  B.fetch = async (input, init) => {
    const response = await fetch(input, init);
    const url = typeof input==='string' ? input : input.url || String(input);
    if (!url.startsWith(A.config.supabaseUrl+'/rest/v1/') || !response.headers.get('content-type')?.includes('json')) return response;
    const body = B.losslessJSON(await response.text()), headers = new Headers(response.headers);
    headers.delete('content-length'); headers.delete('content-encoding');
    return new Response(body, {status:response.status,statusText:response.statusText,headers});
  };
  B.scope = () => A.mode+':'+(A.user?.id || 'public');
  B.clear = () => { B.revision++;B.catalogueGeneration=(B.catalogueGeneration||0)+1;A.catalogue=undefined;A.catalogueError='';A.loadingListings=false;for(const item of B.pending.values()) item.abort.abort(); B.cache.clear();B.pending.clear();B.pageData=null;B.selection=[];B.eventsSeen=new Set(); };
  B.error = error => {
    if (error?.code==='STALE') return '';
    if (['PGRST202','42883','42P01'].includes(error?.code)) return 'Pembaruan backend untuk fitur ini belum diterapkan. Hubungi pengelola platform.';
    if (['23505','23P01'].includes(error?.code)) return 'Data sudah ada atau jadwal bertabrakan. Muat ulang dan periksa pilihanmu.';
    if (error?.code==='23503') return 'Data memiliki relasi atau histori. Gunakan arsip atau check-out agar histori tetap tersimpan.';
    if (['42501','PGRST301','PGRST303'].includes(error?.code)) return 'Akses ditolak. Periksa sesi dan hak akses akunmu.';
    if (error?.safe) return error.message;
    if (error?.code==='23514' || error?.code==='P0001') return 'Perubahan ditolak oleh aturan database. Periksa status, tanggal, persetujuan, dan nominal.';
    return 'Data belum dapat diproses. Periksa koneksi lalu coba lagi.';
  };
  B.fail = message => Object.assign(new Error(message), {safe:true});
  B.load = (key, factory, ttl=20000) => {
    const scope=B.scope(), revision=B.revision, full=scope+':'+key, found=B.cache.get(full);
    if(found && Date.now()-found.time<ttl) return Promise.resolve(found.value);
    if(B.pending.has(full)) return B.pending.get(full).promise;
    const abort=new AbortController();
    const promise=(async()=>{
      const value=await factory(abort.signal);
      if(scope!==B.scope() || revision!==B.revision) throw Object.assign(new Error('Stale request'),{code:'STALE'});
      B.cache.set(full,{time:Date.now(),value});
      if(B.cache.size>60) B.cache.delete(B.cache.keys().next().value);
      return value;
    })().finally(()=>{if(B.pending.get(full)?.promise===promise)B.pending.delete(full);});
    B.pending.set(full,{promise,abort}); return promise;
  };
  B.unwrap = async query => { const result=await query;if(result.error)throw result.error;return result.data ?? []; };
  B.client = () => {if(A.mode!=='connected')throw B.fail('Layanan akun tidak tersedia pada demo.');return A.createClient();};
  B.guardResponse = async promise => {const scope=B.scope(),revision=B.revision,value=await promise;if(scope!==B.scope()||revision!==B.revision)throw Object.assign(new Error('Stale request'),{code:'STALE'});return value;};
  B.rpc = (name,args={},signal) => {const q=B.client().rpc(name,args);return B.guardResponse(B.unwrap(signal?q.abortSignal(signal):q));};
  B.read = (table, {select='*',page=0,size=25,order='created_at',asc=false,filters={}}={}, signal) => {
    let q=B.client().from(table).select(select).order(order,{ascending:asc}).order('id',{ascending:true}).range(page*size,page*size+size-1);
    for(const [key,value] of Object.entries(filters)) q=value===null?q.is(key,null):q.eq(key,value);
    return B.guardResponse(B.unwrap(signal?q.abortSignal(signal):q));
  };
  B.write = async factory => {
    const scope=B.scope(), revision=B.revision;
    if(!A.user || A.mode!=='connected')throw B.fail('Masuk terlebih dahulu.');
    const value=await B.unwrap(factory(B.client()));
    if(scope!==B.scope() || revision!==B.revision) throw Object.assign(new Error('Stale mutation'),{code:'STALE'});
    B.clear();return value;
  };
  B.csv = rows => rows.map(row=>row.map(value=>'"'+String(value??'').replace(/^[\s]*[=+@\-]/, "'$&").replaceAll('"','""')+'"').join(',')).join('\r\n');
  B.download = (name, text) => {const url=URL.createObjectURL(new Blob(['\ufeff'+text],{type:'text/csv;charset=utf-8'})), a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  B.labels={pending:'Belum lunas',paid:'Lunas',overdue:'Terlambat',cancelled:'Dibatalkan',succeeded:'Berhasil',failed:'Gagal',active:'Aktif',checked_out:'Check-out',transferred:'Pindah kamar',available:'Tersedia',maintenance:'Dalam perbaikan',inactive:'Tidak aktif',draft:'Draft',published:'Dipublikasikan',archived:'Diarsipkan',waiting:'Menunggu',in_progress:'Diproses',awaiting_confirmation:'Menunggu konfirmasi',resolved:'Selesai',accepted:'Disetujui',placed:'Ditempatkan',declined:'Ditolak',expired:'Kedaluwarsa',low:'Rendah',medium:'Sedang',high:'Tinggi',urgent:'Mendesak',male:'Putra',female:'Putri',mixed:'Campur'};
  B.badge = status => N.badge(B.labels[status] || status);
})(window.NA, window.NK);
