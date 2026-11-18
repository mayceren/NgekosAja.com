import { mkdirSync,writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { connect,localConfiguration,safeError } from './local-database.mjs';

const descriptions={
 profiles:'Profil privat dengan ID yang sama dengan Supabase Auth. Email/kata sandi dikelola Auth, tidak disalin ke tabel aplikasi.',
 user_roles:'Keanggotaan peran server; pengguna dapat mempunyai beberapa peran tanpa mengganti identitas.',
 user_settings:'Preferensi tampilan dan indikator notifikasi per identitas.',
 properties:'Properti milik satu pemilik terotorisasi; arsip mempertahankan riwayat.',
 property_images:'Galeri berurutan berupa path metadata; tidak membuat bucket atau mengunggah file.',
 property_rules:'Peraturan properti berurutan, satu peraturan per baris.',property_landmarks:'Area sekitar dan jarak ilustrasi sesuai listing versi 2.',
 facilities:'Master fasilitas publik nonpersonal.',property_facilities:'Relasi fasilitas yang berlaku untuk properti.',
 rooms:'Inventaris kamar, harga saat ini, dan kondisi operasional; Terisi dihitung dari agreement aktif.',room_facilities:'Relasi fasilitas per kamar.',
 tenants:'Identitas penghuni yang tetap sama dengan profil; penempatan dan harga ada pada agreement.',
 rental_agreements:'Histori sewa/penempatan dengan snapshot harga, tanpa menyalin owner/property yang dapat diturunkan dari kamar.',
 invoices:'Tagihan bulanan terkait agreement, termasuk snapshot bukti historis.',recurring_invoices:'Konfigurasi tagihan berkala per agreement; generator eksplisit, tanpa scheduler.',
 transactions:'Ledger append-only percobaan pembayaran sewa atau promosi, berhasil maupun gagal.',boost_campaigns:'Periode promosi 30 hari dengan pembayaran atau grant development yang tidak dianggap pendapatan.',
 complaints:'Tiket fasilitas sesuai agreement asal; konfirmasi akhir oleh penghuni.',complaint_histories:'Timeline append-only yang dibuat trigger, bukan input bebas browser.',
 complaint_attachments:'Metadata lampiran tiket. Penulisan browser ditutup selama cloud storage belum tersedia.',complaint_notes:'Catatan tindakan yang dibagikan kepada pihak terkait; tidak ada catatan internal tersembunyi.',
 complaint_analyses:'Rekomendasi berbasis aturan lokal yang diterima pengguna, bukan hasil API AI.',
 conversations:'Percakapan properti dan satu calon penghuni; identitas tetap saat menjadi penghuni.',conversation_members:'Dua peserta sah: pemilik properti dan calon penghuni; menyimpan penanda baca.',
 messages:'Pesan append-only. Wajib mempunyai teks atau lampiran pada akhir transaksi.',message_attachments:'Metadata lampiran gambar pesan; tidak menyediakan upload cloud.',
 notifications:'Notifikasi privat dengan key deduplikasi per pengguna.',favorites:'Wishlist terikat identitas, tetap ada setelah check-in.',recent_searches:'Pencarian tersimpan per pengguna; UI Phase 2 dapat mengambil lima terbaru.',
 listing_analytics:'Event listing bertanggal Jakarta yang dideduplikasi; akses tulis hanya RPC aktor login, tanpa klaim unique visitor.',
 activity_logs:'Audit append-only tanpa payload data pribadi; scoped ke pemilik dan admin.'
};
const columnDescriptions={
 id:'Identitas UUID record; unik dan wajib.',user_id:'Identitas profil pemilik data ini.',owner_id:'Profil pemilik properti/portofolio; bukan input role registrasi.',
 actor_id:'Profil aktor tindakan; NULL untuk operasi server tanpa pengguna.',granted_by:'Profil pemberi peran; NULL untuk bootstrap server.',
 display_name:'Nama tampilan pengguna, bukan email login.',phone:'Kontak privat opsional, hanya format telepon yang diizinkan.',role:'Peran prospect, tenant, owner atau admin; penulisan hanya server.',
 notifications_enabled:'Preferensi badge; tidak menonaktifkan pencatatan notifikasi.',compact_mode:'Preferensi kepadatan tampilan.',sidebar_collapsed:'Preferensi sidebar ringkas.',
 property_id:'Properti terkait; kepemilikan diturunkan dari properties.owner_id.',room_id:'Kamar terkait; properti diturunkan dari rooms.property_id.',
 facility_id:'Referensi master fasilitas.',agreement_id:'Perjanjian sewa sumber; tenant/kamar/pemilik diturunkan dari relasi ini.',
 tenant_id:'Profil penghuni yang juga terdaftar pada tenants.',invoice_id:'Tagihan terkait; wajib untuk transaksi sewa, NULL untuk boost.',
 transaction_id:'Pembayaran boost berhasil; NULL hanya untuk grant development.',complaint_id:'Tiket keluhan induk.',conversation_id:'Percakapan induk.',
 sender_id:'Profil pengirim, harus anggota percakapan melalui FK komposit.',message_id:'Pesan induk lampiran.',prospect_id:'Profil calon penghuni/penghuni yang memulai percakapan.',
 uploaded_by:'Profil pengunggah metadata lampiran tiket.',author_id:'Profil penulis catatan.',accepted_by:'Profil yang menerima rekomendasi lokal.',
 name:'Nama entitas yang ditampilkan.',location:'Nama kawasan pencarian.',address:'Alamat properti yang disiapkan pemilik untuk listing publik; jangan masukkan kontak pribadi.',
 description:'Uraian entitas.',base_rent:'Harga dasar listing saat ini dalam rupiah; tidak mengubah snapshot sewa/tagihan.',rent:'Nominal sewa dalam rupiah, tanpa pecahan.',
 gender_policy:'Kebijakan penghuni mixed/male/female.',room_size:'Label ukuran kamar.',publication_status:'draft, published atau archived; hanya published masuk katalog.',
 image_path:'Path gambar katalog; bukan data URI atau kode JavaScript.',alt_text:'Deskripsi alternatif gambar.',position:'Urutan tampilan mulai nol.',rule_text:'Satu peraturan properti.',
 distance_label:'Label estimasi jarak, bukan hasil geolokasi.',is_illustrative:'Penanda informasi sekitar merupakan ilustrasi.',code:'Kode master yang stabil dan unik.',
 number:'Nomor kamar unik dalam properti.',room_type:'Tipe kamar seperti Standard atau Deluxe.',operational_status:'available, maintenance atau inactive; occupied dihitung dari sewa aktif.',
 start_date:'Tanggal awal berlaku (Jakarta).',end_date:'Tanggal akhir sewa inklusif; untuk kampanye merupakan batas eksklusif start_date + 30.',
 closed_on:'Tanggal check-out/pindah eksklusif. NULL selama active; memungkinkan turnover pada tanggal yang sama.',payment_day:'Hari pembayaran 1–28 agar valid di semua bulan.',
 status:'Status proses; daftar nilai dan pembatasan terdapat pada CHECK di bawah.',period_start:'Tanggal pertama bulan tagihan; unik per agreement, termasuk tagihan dibatalkan.',
 due_date:'Tanggal jatuh tempo lokal; overdue dihitung saat baca, tidak disimpan sebagai status.',amount:'Nominal rupiah snapshot. Nilai gagal tercatat sebagai percobaan, bukan pendapatan.',
 admin_fee:'Biaya admin rupiah: 2000 untuk sewa, 0 untuk boost; hanya sukses dihitung revenue.',notes:'Catatan tagihan, dibekukan setelah percobaan pembayaran.',
 tenant_name_snapshot:'Nama penghuni saat tagihan dibuat, tidak mengikuti edit profil.',property_name_snapshot:'Nama properti saat tagihan dibuat.',room_number_snapshot:'Nomor kamar saat tagihan dibuat.',
 start_month:'Tanggal pertama bulan mulai jadwal.',last_generated_month:'Cursor bulan terakhir; tidak boleh bergerak mundur.',active:'Apakah jadwal masih aktif; otomatis false ketika sewa ditutup.',
 kind:'Jenis transaksi rent/boost atau jenis event view/detail/contact sesuai tabel.',method:'Label metode pembayaran; tanpa rekening/kartu/OTP.',idempotency_key:'Kunci unik retry server, payload berbeda ditolak.',
 is_simulation:'Menandai transaksi ilustrasi; Phase 1 tidak memproses uang.',occurred_at:'Waktu pembayaran/percobaan sebagai instant timestamptz.',source:'payment atau development_grant; grant tanpa transaksi tidak menambah pendapatan.',
 title:'Judul singkat tiket/notifikasi.',category:'Kategori fasilitas sesuai daftar CHECK.',urgency:'Urgensi yang dipilih pelapor.',priority:'Prioritas penanganan yang diputuskan pengelola.',
 estimated_completion:'Tanggal estimasi penyelesaian opsional.',confirmed_at:'Waktu penghuni mengonfirmasi selesai, hanya terisi pada resolved.',previous_status:'Status sebelum perubahan; NULL pada pencatatan awal.',
 note:'Uraian transisi pada timeline.',storage_path:'Path metadata file privat; belum ada bucket/storage policy Phase 1.',mime_type:'MIME JPG/PNG/WebP.',size_bytes:'Ukuran file 1–1048576 byte.',
 body:'Isi teks pesan/catatan/notifikasi.',rule_version:'Versi aturan lokal yang menghasilkan rekomendasi.',suggested_category:'Kategori yang direkomendasikan aturan lokal.',
 suggested_priority:'Prioritas yang direkomendasikan aturan lokal.',summary:'Ringkasan input pengguna.',safe_action:'Saran aman, bukan diagnosis teknis.',emergency:'Penanda eskalasi keselamatan dari aturan lokal.',
 last_read_at:'Waktu baca terakhir anggota sendiri melalui RPC.',dedupe_key:'Kunci notifikasi unik per penerima.',route:'Rute aplikasi tujuan; tidak memanggil layanan eksternal.',read_at:'Waktu pengguna membaca notifikasi; NULL berarti belum dibaca.',
 query:'Teks pencarian pengguna.',session_id:'UUID sesi pengamatan, bukan autentikasi.',event_date:'Tanggal bisnis Jakarta untuk deduplikasi event.',
 entity_table:'Nama tabel yang diaudit.',entity_id:'UUID entitas audit; sengaja bukan FK agar log tetap ada setelah penghapusan yang sah.',action:'Jenis perubahan database.',
 created_at:'Waktu record dibuat, timestamptz; instant konsisten lintas zona waktu.',updated_at:'Waktu pembaruan dari trigger; ledger/history tetap append-only.'
};
const md=value=>String(value??'—').replaceAll('|','\\|').replaceAll('\n',' ');

export async function generateDatabaseDocs(client) {
 mkdirSync('docs/database',{recursive:true});
 const tables=(await client.query("select c.oid::int,c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' order by c.relname")).rows;
 const missing=Object.keys(descriptions).filter(name=>!tables.some(t=>t.relname===name));
 if(missing.length)throw new Error(`Schema belum lengkap; dokumen tidak ditimpa. Tabel belum ada: ${missing.join(', ')}`);
 const cols=(await client.query("select c.relname as table_name,a.attnum,a.attname as name,format_type(a.atttypid,a.atttypmod) as type,a.attnotnull as not_null,pg_get_expr(d.adbin,d.adrelid) as default_value from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum where n.nspname='public' and c.relkind='r' order by c.relname,a.attnum")).rows;
 const constraints=(await client.query("select c.conrelid::int as table_oid,c.conname,c.contype,c.conkey,c.confkey,c.confrelid::int as referenced_oid,nt.nspname as referenced_schema,t.relname as referenced_table,pg_get_constraintdef(c.oid) as definition from pg_constraint c join pg_namespace n on n.oid=c.connamespace left join pg_class t on t.oid=c.confrelid left join pg_namespace nt on nt.oid=t.relnamespace where n.nspname='public' order by c.conrelid,c.conname")).rows;
 const indexes=(await client.query("select tablename,indexname,indexdef from pg_indexes where schemaname='public' order by tablename,indexname")).rows;
 let dictionary='# Data Dictionary\n\nDihasilkan dari katalog PostgreSQL yang menjalankan seluruh migrasi. Semua nilai uang disimpan sebagai bigint rupiah. Kolom nullable, default, PK/FK, constraint dan index di bawah sesuai database aktual.\n\n';
 let erd='# Entity Relationship Diagram\n\nDihasilkan dari PK/FK dan kolom database aktual. `auth_users` mewakili tabel Supabase Auth eksternal; hanya ID yang ditampilkan. Hubungan audit entity_id sengaja tidak mempunyai FK.\n\n```mermaid\nerDiagram\n  auth_users {\n    uuid id PK\n  }\n';
 for(const table of tables) {
  const tc=constraints.filter(c=>c.table_oid===table.oid),columns=cols.filter(c=>c.table_name===table.relname);
  dictionary+=`## ${table.relname}\n\n${descriptions[table.relname]} RLS: aktif.\n\n| Kolom | Tipe | Kunci / FK | NULL | Default | Fungsi |\n| --- | --- | --- | --- | --- | --- |\n`;
  erd+=`  ${table.relname} {\n`;
  for(const col of columns) {
   const pk=tc.some(c=>c.contype==='p'&&c.conkey.includes(col.attnum));
   const fk=tc.filter(c=>c.contype==='f'&&c.conkey.includes(col.attnum));
   const unique=tc.some(c=>c.contype==='u'&&c.conkey.length===1&&c.conkey[0]===col.attnum);
   const keys=[pk?'PK':'',unique?'UNIQUE':'',...fk.map(c=>`FK → ${c.referenced_schema}.${c.referenced_table} (${c.definition})`)].filter(Boolean).join('; ');
   const description=columnDescriptions[col.name];if(!description)throw new Error(`Deskripsi kolom belum ada: ${table.relname}.${col.name}`);
   dictionary+=`| ${col.name} | ${md(col.type)} | ${md(keys)} | ${col.not_null?'Tidak':'Ya'} | ${md(col.default_value)} | ${md(description)} |\n`;
   const erdKeys=[pk?'PK':'',fk.length?'FK':'',unique?'UK':''].filter(Boolean);
   erd+=`    ${col.type.replaceAll(/[^a-zA-Z0-9_]/g,'_')} ${col.name}${erdKeys.length?' '+erdKeys.join(', '):''}\n`;
  }
  erd+='  }\n';
  dictionary+='\nConstraint tabel (termasuk CHECK dan FK komposit):\n\n';
  dictionary+=tc.map(c=>`- **${c.conname}**: \`${c.definition}\``).join('\n')+'\n\nIndex aktual:\n\n'+indexes.filter(i=>i.tablename===table.relname).map(i=>`- \`${i.indexdef}\``).join('\n')+'\n\n';
 }
 for(const c of constraints.filter(c=>c.contype==='f')) {
  const table=tables.find(t=>t.oid===c.table_oid),localCols=cols.filter(col=>col.table_name===table.relname&&c.conkey.includes(col.attnum));
  const parent=c.referenced_schema==='auth'?'auth_users':c.referenced_table;
  const unique=constraints.some(k=>k.table_oid===c.table_oid&&['p','u'].includes(k.contype)&&k.conkey.length===c.conkey.length&&k.conkey.every(v=>c.conkey.includes(v)));
  erd+=`  ${parent} ${localCols.every(v=>v.not_null)?'||':'|o'}--${unique?'o|':'o{'} ${table.relname} : "${localCols.map(v=>v.name).join('_')}"\n`;
 }
 erd+='```\n\nKardinalitas `||` wajib satu, `|o` opsional satu, `o{` nol atau banyak. Child FK yang UNIQUE/PK menghasilkan relasi paling banyak satu. Constraint UNIQUE komposit dan exclusion interval lengkap ada di [Data Dictionary](DATA_DICTIONARY.md).\n';
 writeFileSync('docs/database/DATA_DICTIONARY.md',dictionary);writeFileSync('docs/database/ERD.md',erd);
 const policies=(await client.query("select tablename,policyname,cmd,roles,qual,with_check from pg_policies where schemaname='public' order by tablename,policyname")).rows;
 const grants=(await client.query("select table_name,grantee,privilege_type from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated','service_role') order by table_name,grantee,privilege_type")).rows;
 const columnGrants=(await client.query("select table_name,column_name,grantee,privilege_type from information_schema.column_privileges where table_schema='public' and grantee='authenticated' and privilege_type='UPDATE' order by table_name,column_name")).rows;
 const functions=(await client.query("select p.proname,pg_get_function_identity_arguments(p.oid) as arguments,p.prosecdef,has_function_privilege('anon',p.oid,'execute') as anon,has_function_privilege('authenticated',p.oid,'execute') as authenticated,has_function_privilege('service_role',p.oid,'execute') as server from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by p.proname")).rows;
 let rls='# Row Level Security dan izin aktual\n\nSemua tabel public mengaktifkan RLS dalam transaksi pembuatannya. `private` tidak diekspos pada Data API. Migrasi awal menutup default grants; kebijakan akhir menambah akses yang sudah dibatasi. Tabel tanpa kebijakan tulis tetap tertutup. PUBLIC tidak mempunyai EXECUTE pada fungsi aplikasi.\n\nAnonymous hanya mendapat `public_listings()` dengan proyeksi kolom tetap dan master facilities. Base properties tidak dapat dibaca anonymous. Profil, kontak, nomor kamar internal, owner UUID, dan transaksi tidak termasuk hasil katalog. Pemilik wajib menjaga isi teks listing tidak mengandung kontak pribadi.\n\n`profiles` hanya diri sendiri, penghuni terkait pemilik melalui histori agreement, atau admin. Notifikasi/pengaturan/wishlist tetap milik pengguna sendiri, termasuk saat admin login. Peserta chat dibatasi FK + membership yang dibuat RPC, admin terotorisasi dapat membaca untuk kewenangan platform.\n\nRole admin/owner tidak diambil dari user_metadata. Trigger Auth selalu memberi prospect. `server_grant_role` hanya service_role dan memeriksa claim server. Prospect menjadi tenant dengan UUID yang sama pada check-in oleh pemilik yang telah mempunyai percakapan terkait. Persetujuan identitas/check-in formal perlu diselesaikan pada Phase 2.\n\nMutasi sewa, tagihan, status tiket, keanggotaan chat dan pembayaran melalui fungsi dengan search_path kosong serta pemeriksaan otorisasi. Pembayaran dan role grant hanya server; bahkan JWT admin aplikasi tidak dapat memanggil pencatat pembayaran. Retry payment menggunakan lock dan kunci idempotensi, bukan status dari browser.\n\nLampiran tiket/pesan tidak mempunyai izin tulis browser selama cloud storage belum diimplementasikan. Analytics anonim juga ditutup; RPC hanya menerima aktor login. Riwayat, transaksi dan audit append-only. service_role adalah trust boundary server (BYPASSRLS), tidak boleh masuk frontend.\n\n## Policies\n\nKatalog berikut dihasilkan langsung dari pg_policies setelah seluruh migrasi dijalankan. `—` berarti ekspresi tidak dipakai oleh jenis command tersebut.\n\n| Tabel | Policy | Command | Role | USING | WITH CHECK |\n| --- | --- | --- | --- | --- | --- |\n';
 rls+=policies.map(p=>`| ${p.tablename} | ${p.policyname} | ${p.cmd} | ${md(p.roles)} | ${md(p.qual)} | ${md(p.with_check)} |`).join('\n');
 rls+='\n\n## Grants tabel\n\n| Tabel/view | Role | Izin |\n| --- | --- | --- |\n'+grants.map(g=>`| ${g.table_name} | ${g.grantee} | ${g.privilege_type} |`).join('\n');
 rls+='\n\n## UPDATE per kolom\n\nSelain izin tabel di atas, browser hanya memperoleh UPDATE kolom berikut.\n\n| Tabel | Kolom | Role |\n| --- | --- | --- |\n'+columnGrants.map(g=>`| ${g.table_name} | ${g.column_name} | ${g.grantee} |`).join('\n');
 rls+='\n\n## EXECUTE fungsi public\n\n| Fungsi / argumen | SECURITY DEFINER | anon | authenticated | service_role |\n| --- | --- | --- | --- | --- |\n'+functions.map(f=>`| ${f.proname}(${md(f.arguments)}) | ${f.prosecdef} | ${f.anon} | ${f.authenticated} | ${f.server} |`).join('\n');
 rls+='\n\n## Batas verifikasi\n\nTes native PostgreSQL menjalankan policy/GRANT sebagai role SQL anon/authenticated/service_role serta claim Auth kontrak. Ini memverifikasi SQL, bukan verifikasi JWT oleh gateway atau GoTrue. Penerapan remote dan inspeksi katalog RLS/grants telah berhasil setelah persetujuan pengguna; lihat [hasil remote](REMOTE_DEPLOYMENT.md). Pengujian JWT/HTTP dan Auth Admin nyata masih terpisah; Docker diperlukan untuk stack Supabase lokal, bukan untuk akses hosted. Izin upload, gateway pembayaran, realtime, scheduler dan integrasi frontend belum dibuka pada Phase 1. Lihat [laporan pemeriksaan](VERIFICATION.md).\n\nRujukan: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [user profiles Auth](https://supabase.com/docs/guides/auth/managing-user-data), [database functions](https://supabase.com/docs/guides/database/functions).\n';
 writeFileSync('docs/database/RLS_POLICIES.md',rls);
 const stats={tables:tables.length,columns:cols.length,foreign_keys:constraints.filter(c=>c.contype==='f').length,policies:policies.length,public_functions:functions.length};
 writeFileSync('docs/database/schema-catalogue.json',JSON.stringify({stats,tables:tables.map(t=>({name:t.relname,description:descriptions[t.relname],columns:cols.filter(c=>c.table_name===t.relname),constraints:constraints.filter(c=>c.table_oid===t.oid).map(({conname,contype,definition})=>({name:conname,type:contype,definition}))})),policies,functions},null,2)+'\n');
 console.log(`Documentation generated from PostgreSQL catalogue: ${JSON.stringify(stats)}`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
 let client;try {const config=localConfiguration({native:process.argv.includes('--native')});client=await connect(config.db);await generateDatabaseDocs(client);}catch(e){console.error(safeError(e));process.exitCode=1;}finally{if(client)await client.end();}
}
