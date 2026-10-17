# Product improvement roadmap

Dokumen ini merangkum arah pengembangan resaikel setelah MVP. Roadmap ini tidak terikat
deadline kompetisi. Tujuannya adalah menjelaskan seberapa jauh produk dapat berkembang,
batas yang harus tetap dijaga, urutan investasi yang masuk akal, dan syarat sebelum sebuah
fitur boleh dianggap siap produksi.

Roadmap ini melengkapi `PRODUCT_REQUIREMENTS.md`, `ARCHITECTURE.md`, dan
`COMPETITION_READINESS.md`. Dokumen-dokumen tersebut menjelaskan produk dan implementasi
saat ini; dokumen ini menjelaskan arah berikutnya.

## Ringkasan arah produk

Resaikel sebaiknya berkembang dari alat penemuan peluang menjadi **circular manufacturing
decision infrastructure**: sistem yang menghubungkan material sisa, kemampuan workshop,
desain produk, kelayakan produksi, biaya, permintaan, hasil aktual, dan dampak yang dapat
diaudit.

Loop produk yang dituju adalah:

```text
material masuk
  -> interpretasi berbantuan AI
  -> konfirmasi fakta fisik oleh manusia
  -> pencarian desain yang dibatasi katalog
  -> validasi feasibility dan cutting plan
  -> estimasi biaya dan permintaan
  -> keputusan produksi
  -> outcome aktual
  -> pembaruan inventory, model biaya, dan bukti impact
```

AI digunakan untuk memahami input tidak terstruktur, mencari alternatif, dan menjelaskan
hasil. Perhitungan fisik, finansial, ranking, safety gate, dan klaim impact tetap berasal dari
aturan, data terverifikasi, dan engine deterministic.

## Posisi produk yang perlu dipertahankan

Keunggulan utama resaikel bukan sekadar dapat mengenali sampah dari foto. Keunggulannya
adalah mengubah observasi yang belum lengkap menjadi keputusan produksi yang dapat
ditelusuri tanpa membiarkan model mengarang fakta.

Prinsip berikut adalah invariant produk dan tidak boleh dikorbankan ketika scope bertambah:

1. **Measured, never guessed.** Foto tidak menjadi dasar tunggal untuk dimensi, berat,
   komposisi, grade, kekuatan, atau safety.
2. **AI proposes, engines decide.** Model boleh mengusulkan dan menjelaskan; engine serta
   policy yang tervalidasi mengambil keputusan kritis.
3. **Unknown stays unknown.** Nilai yang tidak diketahui tidak diisi dengan default yang
   terlihat seperti hasil pengukuran.
4. **Catalogue-bound manufacturing.** Produk berstatus feasible hanya jika mempunyai
   spesifikasi, proses, dan batas material yang telah direview.
5. **Hard gates before scores.** Peluang yang gagal secara fisik, safety, atau capability tidak
   boleh diselamatkan oleh skor ekonomi.
6. **Explainable money.** Estimasi dan actual menggunakan unit uang integer, basis perhitungan
   yang terlihat, dan versioned assumptions.
7. **Impact follows completed work.** Klaim reuse dan diversion berasal dari outcome aktual,
   bukan hanya potensi atau rekomendasi.
8. **Consent-aware demand.** Identitas dan kebutuhan buyer hanya ditampilkan berdasarkan izin
   yang jelas.
9. **Human override is traceable.** Koreksi manusia diperbolehkan, tetapi perubahan nilai,
   alasan, dan actor harus tercatat.
10. **Graceful degradation.** Kegagalan AI tidak boleh merusak data atau menghasilkan keputusan
    diam-diam; sistem harus dapat berhenti aman atau memakai mode fallback yang diberi label.

## Batas produk

### Batas yang berlaku sekarang

- Feasibility hanya menangani stock dan part rectangular dalam model 2D.
- Cutting menggunakan guillotine layout yang konservatif, bukan global optimum.
- Posisi defect belum direkam sebagai koordinat yang dapat dihindari optimizer.
- Kekuatan struktural, fire safety, food safety, dan chemical safety belum disertifikasi.
- Katalog produk masih terbatas pada template yang telah direview.
- Market evidence masih berupa reference data yang diberi label sample.
- Buyer matching pada umumnya berada di level segment/category, bukan transaksi terjamin.
- Outcome bersifat append-only dan belum mempunyai reversal/correction workflow formal.
- Inventory material belum otomatis berkurang setelah outcome dicatat.
- Belum ada RFQ, quotation, order, payment, logistics, atau dispute workflow.
- Belum ada faktor emisi tervalidasi untuk klaim carbon avoidance.

### Batas yang boleh diperluas dengan evidence

Area berikut dapat diperluas, tetapi hanya setelah mempunyai data, policy, dan test yang
sesuai:

- Material family baru setelah ada schema atribut, aturan safety, dan acceptance dataset.
- Product template baru setelah manufacturing review dan pilot build.
- Irregular geometry setelah format geometri dan optimizer tervalidasi.
- Carbon estimate setelah metodologi, geographic boundary, emission factor, dan versioning
  disepakati.
- Buyer recommendation setelah ada consented demand dan mekanisme verifikasi.
- Automatic inventory mutation setelah reversal, partial stock, dan concurrency semantics
  selesai.
- Automated action setelah confidence threshold, approval boundary, audit trail, dan rollback
  tersedia.

### Batas yang bukan tujuan dekat

Resaikel tidak perlu menjadi general-purpose marketplace, ERP penuh, CAD suite, accounting
system, atau logistics platform. Integrasi dengan sistem-sistem tersebut lebih tepat daripada
menggandakan seluruh fungsinya. Sebuah fitur baru harus membantu keputusan circular
manufacturing atau menutup loop dari material ke outcome; jika tidak, fitur itu berada di luar
inti produk.

## Horizon pengembangan

### Horizon 1 — Trustworthy production MVP

Tujuan: membuat satu workshop dapat menggunakan alur utama berulang kali dengan data yang
aman, hasil yang dapat dikoreksi, dan operasi yang dapat dipantau.

#### 1. Demo dan live-AI reliability

- Selesaikan real-photo acceptance suite untuk setiap material family yang didukung.
- Buat evaluation dataset berversi: expected family, atribut yang boleh diamati, atribut yang
  wajib unknown, dan unsupported claims.
- Catat latency, token usage, schema-valid rate, repair rate, fallback, dan model version.
- Tambahkan circuit breaker dan status operasional untuk quota/provider failure.
- Pisahkan mode `live`, `mock`, dan `degraded` secara terlihat di UI dan audit event.
- Sinkronkan seluruh dokumentasi dengan konfigurasi deployment aktual.

**Exit gate:** live analysis lulus evaluation set, failure state dapat dipulihkan, dan tidak ada
hasil mock yang dapat terlihat sebagai hasil model live.

#### 2. Outcome correction dan material ledger

- Gunakan reversal plus replacement, bukan edit diam-diam terhadap outcome lama.
- Simpan reason code, actor, timestamp, dan referensi outcome yang dibalik.
- Buat material ledger append-only untuk receipt, reservation, consumption, adjustment, dan
  reversal.
- Dukung partial sheet atau partial quantity tanpa kehilangan identitas stock.
- Gunakan transaction/idempotency untuk mencegah double consumption.
- Rekonsiliasi saldo ledger dengan production outcome.

**Exit gate:** setiap perubahan stock dapat ditelusuri ke event bisnis dan dapat dikoreksi tanpa
menghapus sejarah.

#### 3. Persistence dan deployment assurance

- Jalankan Firestore rules tests dengan emulator di CI.
- Verifikasi seluruh composite index terhadap staging project.
- Tambahkan route/repository integration tests untuk Auth, Firestore, dan Storage.
- Tambahkan post-deploy smoke test untuk sign-in, upload, analysis, discovery, save, outcome,
  dan impact.
- Tambahkan backup, restore drill, retention policy, dan incident runbook.
- Pantau error rate, job age, AI spend, quota, request latency, dan failed uploads.

**Exit gate:** deployment dapat direproduksi, tenant isolation terbukti otomatis, dan restore
pernah diuji.

#### 4. UX untuk penggunaan berulang

- Tambahkan saved draft, resumable workflow, dan activity timeline.
- Perjelas provenance pada setiap field: AI-observed, user-entered, measured, derived, unknown.
- Buat comparison view untuk beberapa opportunity.
- Tambahkan printable work instruction dan cutting checklist.
- Lakukan accessibility audit keyboard, screen reader, contrast, dan mobile workshop usage.
- Sediakan Bahasa Indonesia dan English secara konsisten.

**Exit gate:** pengguna baru dapat menyelesaikan satu loop tanpa pendampingan, dan pengguna
lama dapat melanjutkan pekerjaan yang tertunda.

### Horizon 2 — Pilot-ready workshop intelligence

Tujuan: membuktikan bahwa sistem menghasilkan keputusan yang lebih cepat dan lebih baik pada
beberapa workshop nyata.

#### 1. Pilot program dan product analytics

- Rekrut workshop pilot dengan jenis waste yang berbeda.
- Tetapkan baseline sebelum penggunaan: waktu klasifikasi, material yang tidak termanfaatkan,
  waktu costing, dan conversion dari ide ke produksi.
- Ukur activation, time-to-first-feasible-opportunity, save rate, production conversion,
  sell-through, correction rate, dan repeat usage.
- Kumpulkan alasan rekomendasi ditolak dan gunakan sebagai feedback katalog, bukan langsung
  sebagai training data tanpa review.
- Pisahkan metrik sample, pilot, dan production.

**Exit gate:** terdapat beberapa loop produksi nyata dan bukti bahwa produk memperbaiki minimal
satu outcome pengguna yang disepakati.

#### 2. Catalogue governance

- Buat workflow proposal, manufacturing review, pilot build, approval, publication, dan
  deprecation untuk template.
- Version-kan bill of materials, process steps, allowable materials, tolerances, tooling,
  kerf, finishing, dan safety notes.
- Pastikan opportunity menyimpan versi template yang digunakan agar hasil lama reproducible.
- Sediakan catalogue coverage report untuk melihat material yang sering tidak mendapat kandidat.
- Hindari memasukkan desain hasil AI langsung sebagai feasible template.

**Exit gate:** setiap template feasible memiliki owner, versi, bukti pilot build, dan batas
penggunaan yang eksplisit.

#### 3. Decision trace dan evaluation

- Tampilkan apa yang diobservasi AI, fakta yang dikonfirmasi manusia, dan keputusan engine.
- Tampilkan alasan kandidat lolos atau gagal setiap feasibility gate.
- Simpan prompt version, model version, schema version, dan evaluation version.
- Buat regression suite dari failure nyata dengan data yang telah dianonimkan.
- Tambahkan threshold per field; confidence rendah selalu meminta konfirmasi.

**Exit gate:** satu rekomendasi dapat direkonstruksi dari input sampai ranking tanpa membaca log
internal atau mengandalkan penjelasan model.

#### 4. Evidence-based market intelligence

- Buat ingestion workflow untuk quotation, listing, completed transaction, dan registered demand.
- Rekam source type, geography, date, currency, quantity basis, verification state, dan expiry.
- Normalisasi unit dan currency tanpa menyembunyikan sumber asli.
- Gunakan freshness dan evidence quality dalam price band serta ranking.
- Jangan menganggap listing price sebagai realised sale.

**Exit gate:** market band produksi tidak lagi bergantung pada sample data dan setiap angka dapat
ditelusuri ke evidence yang berizin.

### Horizon 3 — Multi-workshop circular operations

Tujuan: menghubungkan supply material, kemampuan produksi, dan permintaan di lebih dari satu
organisasi tanpa mengorbankan consent dan tenant isolation.

#### 1. Material exchange dan matching

- Tambahkan opt-in material listing dengan disclosure yang dapat dipilih pemilik.
- Cocokkan material terhadap workshop berdasarkan geography, capability, capacity, minimum lot,
  dan material constraints.
- Tampilkan match sebagai recommendation, bukan allocation otomatis.
- Lindungi lokasi rinci, volume sensitif, dan identitas bisnis sampai consent diberikan.
- Tambahkan expiry dan withdrawal untuk listing/demand.

#### 2. RFQ dan quotation

- Mulai dari request-for-quotation, bukan payment marketplace.
- Version-kan specification, quantity, deadline, delivery location, cost assumptions, dan quote.
- Rekam acceptance, rejection, expiry, dan perubahan scope.
- Pisahkan estimated margin internal dari harga yang dibagikan kepada buyer.
- Tambahkan messaging hanya jika diperlukan untuk menyelesaikan RFQ dan dapat dimoderasi.

#### 3. Capacity dan production planning

- Tambahkan workshop calendar, machine availability, batch size, lead time, dan labour capacity.
- Hitung capacity shortfall secara deterministic.
- Rekomendasikan split order atau alternate workshop, dengan approval manusia.
- Hindari autonomous commitment terhadap tanggal atau kuantitas.

#### 4. Integrasi

- Sediakan CSV/API import untuk inventory dan actual cost.
- Tambahkan webhook atau API untuk ERP/accounting/logistics setelah domain event stabil.
- Gunakan organization-scoped API keys atau OAuth, rate limit, audit log, dan revocation.
- Dokumentasikan contract dan backward compatibility sebelum membuka public API.

**Exit gate Horizon 3:** matching dan RFQ dapat digunakan lintas organisasi dengan consent,
contract versioning, audit trail, dan tidak ada data tenant yang bocor.

### Horizon 4 — Advanced manufacturing and verified impact

Tujuan: memperluas kedalaman teknis hanya pada area yang telah dibuktikan dibutuhkan oleh pilot.

#### 1. Geometry dan optimization

- Simpan posisi defect dan forbidden zones.
- Tambahkan non-guillotine rectangular nesting sebelum irregular geometry.
- Evaluasi polygon nesting atau CAD import hanya jika coverage rectangular tidak memadai.
- Bandingkan optimizer dengan baseline dan beri batas waktu komputasi.
- Pertahankan preview dan manual approval atas cutting plan.

#### 2. Material characterization

- Tambahkan measurement workflow untuk moisture, density, thickness distribution, contamination,
  atau grade sesuai material family.
- Integrasikan sensor hanya jika calibration, unit, timestamp, dan device provenance tersedia.
- Gunakan lab/certification evidence untuk claim yang berhubungan dengan safety.
- Bedakan visual classification, measured property, dan certified property.

#### 3. Verified environmental accounting

- Tentukan functional unit dan system boundary untuk setiap impact metric.
- Gunakan emission factor dari sumber yang dapat dikutip dan version-kan factor tersebut.
- Tampilkan geography, year, uncertainty, exclusions, dan methodology.
- Pisahkan material reused, waste diverted, estimated avoided impact, dan verified impact.
- Siapkan export audit pack untuk pihak ketiga.
- Jangan menjumlahkan material dengan unit yang tidak kompatibel tanpa conversion evidence.

#### 4. Learning loop

- Gunakan outcome aktual untuk memperbaiki cost defaults, yield assumptions, dan ranking.
- Terapkan cohort/segment update; jangan mencampur workshop dengan struktur biaya berbeda.
- Simpan model atau rule version agar keputusan lama tetap reproducible.
- Gunakan offline evaluation dan staged rollout sebelum mengubah ranking produksi.
- Jangan melatih model menggunakan foto atau data organisasi tanpa consent yang eksplisit.

**Exit gate Horizon 4:** peningkatan optimizer dan impact dapat divalidasi terhadap baseline,
memiliki metodologi, dan dapat diaudit oleh pihak di luar tim pembuat.

## Enhancement backlog menurut domain

| Domain | Enhancement berikutnya | Enhancement lanjutan | Batas utama |
|---|---|---|---|
| Material | ledger, partial stock, defect coordinates | sensors dan certification | AI vision bukan alat ukur |
| Catalogue | governance dan versioning | partner-authored templates | review manusia sebelum feasible |
| Feasibility | richer gates dan defect avoidance | polygon/CAD optimization | bukan structural certification |
| Cost | actual-vs-estimate feedback | workshop-specific predictive defaults | final arithmetic tetap deterministic |
| Market | verified evidence ingestion | geographic trend and demand forecast | listing bukan completed sale |
| Buyer | consented demand matching | RFQ dan capacity allocation | match bukan purchase guarantee |
| Outcome | reversal dan reconciliation | multi-stage production records | tidak menghapus audit history |
| Impact | methodology dan provenance | third-party-verifiable accounting | carbon hanya dengan factor tervalidasi |
| AI | evaluation, observability, decision trace | multimodal retrieval dan bounded agents | tidak boleh mengambil keputusan kritis sendiri |
| Platform | CI emulator, monitoring, backup | public integrations dan enterprise controls | tenant isolation wajib |

## Batas penggunaan AI dan agentic workflow

Agentic capability dapat ditambahkan, tetapi agent harus bekerja di dalam permission dan
approval boundary yang eksplisit.

### Dapat dilakukan AI tanpa approval tambahan

- Mendeskripsikan atribut visual non-kritis dengan confidence.
- Mengambil kandidat hanya dari katalog yang diberikan.
- Merangkum evidence dan menjelaskan output deterministic.
- Menyiapkan draft work instruction, RFQ, atau comparison.
- Menandai data yang hilang atau kontradiktif.

### Harus meminta konfirmasi manusia

- Mengubah ukuran, jumlah, kondisi, atau material family terkonfirmasi.
- Menyimpan kandidat sebagai keputusan produksi.
- Mengubah cost assumption atau target margin.
- Mempublikasikan material atau demand ke organisasi lain.
- Mengirim RFQ, menerima quotation, atau membuat commitment.
- Mengoreksi outcome atau saldo inventory.

### Tidak boleh diputuskan AI tanpa sistem tervalidasi

- Structural, food, fire, electrical, atau chemical safety.
- Grade atau komposisi yang memerlukan pengujian.
- Harga final, payment, atau contractual commitment.
- Klaim carbon atau environmental certification.
- Penghapusan data, irreversible action, atau cross-tenant disclosure.

## Data dan governance yang harus tumbuh bersama fitur

Setiap data penting minimal memiliki:

- organization dan actor;
- source/provenance;
- waktu observasi atau kejadian;
- unit dan currency yang eksplisit;
- version untuk schema, rule, template, dan model yang relevan;
- confidence hanya untuk hasil probabilistik;
- verification state;
- correction/reversal link;
- retention dan consent state jika mengandung data pihak lain.

Data outcome tidak boleh ditimpa untuk membuat hasil terlihat lebih baik. Sample data, pilot
data, dan production data harus dapat dibedakan dalam database, analytics, UI, dan ekspor.

## Metrik keberhasilan

### North-star candidate

**Verified material successfully converted into completed production outcomes per active
workshop per month.**

Metrik ini menghindari optimasi dangkal seperti jumlah scan atau jumlah rekomendasi. Sebuah
rekomendasi baru bernilai jika material benar-benar dapat diproduksi dan outcome-nya tercatat.

### Product metrics

- Time to first confirmed material.
- Time to first feasible opportunity.
- Analysis completion dan schema-valid rate.
- Human correction rate per field.
- Opportunity save dan production conversion rate.
- Estimate-to-actual cost and yield variance.
- Sell-through dan repeat production rate.
- Material ledger reconciliation error.
- Percentage of recommendations with complete decision trace.

### Impact metrics

- Material reused dari completed outcomes, per compatible unit.
- Waste/cutting ratio dan yield aktual.
- Jumlah material yang berpindah dari unused inventory menjadi production outcome.
- Produk dibuat dan terjual.
- Verified diversion atau environmental estimate hanya jika metodologinya tersedia.

### Reliability and safety metrics

- Cross-tenant access failures dalam automated tests.
- AI unsupported-claim rejection rate.
- Job failure, retry, fallback, dan stale-job rate.
- Correction/reversal frequency.
- Backup restore success dan recovery time.
- Cost per completed analysis dan per completed production outcome.

## Urutan implementasi yang direkomendasikan

Urutan ini sengaja mendahulukan integritas data dan pembuktian penggunaan dibanding perluasan
fitur:

1. Live-AI evaluation, observability, dan decision trace.
2. Outcome correction serta append-only material ledger.
3. Emulator/integration CI, deployment smoke test, backup, dan monitoring.
4. UX penggunaan berulang dan provenance yang lebih jelas.
5. Pilot workshop serta baseline/product analytics.
6. Catalogue governance dan versioning.
7. Verified market evidence ingestion.
8. Consented material/demand exchange.
9. RFQ dan quotation.
10. Capacity planning dan external integrations.
11. Advanced geometry/material characterization.
12. Verified environmental accounting dan audited learning loop.

## Aturan prioritas untuk backlog baru

Sebuah enhancement mendapat prioritas tinggi jika memenuhi minimal dua kondisi berikut:

- Menutup celah pada loop material ke outcome.
- Mengurangi risiko keputusan fisik, finansial, privacy, atau sustainability yang salah.
- Meningkatkan jumlah outcome produksi aktual.
- Menghasilkan evidence yang sebelumnya tidak tersedia.
- Mengurangi pekerjaan manual berulang tanpa menghilangkan approval penting.
- Dibutuhkan oleh beberapa pilot, bukan hanya satu edge case.
- Dapat diukur keberhasilannya.

Tunda enhancement jika:

- hanya membuat demo terlihat lebih kompleks;
- mengganti disclosure dengan confidence palsu;
- belum mempunyai owner dan sumber data;
- memerlukan marketplace penuh sebelum ada permintaan nyata;
- mengotomatisasi proses yang policy koreksinya belum selesai;
- menghasilkan environmental claim tanpa metodologi;
- menambah material atau template tanpa acceptance criteria.

## Definition of done untuk setiap enhancement

Sebuah fitur belum selesai hanya karena UI dan happy path tersedia. Minimal harus ada:

1. Problem, user, dan measurable outcome yang jelas.
2. Domain contract dan batas input/output.
3. Provenance, permission, tenancy, dan audit behavior.
4. Failure, retry, correction, dan rollback semantics.
5. Unit test untuk engine dan integration test untuk persistence boundary.
6. Empty, loading, error, partial, dan degraded states di UI.
7. Accessibility dan mobile verification.
8. Observability dan biaya operasional yang dapat dilihat.
9. Migration/backward-compatibility plan jika schema berubah.
10. Dokumentasi limitation dan runbook.
11. Acceptance evidence dari dataset atau pilot yang relevan.

## Risiko strategis

- **AI terlihat ornamental.** Mitigasi: tampilkan decision trace dan kasus ketika engine menolak
  usulan model.
- **Scope berubah menjadi marketplace generik.** Mitigasi: prioritaskan data dan keputusan
  manufacturing; integrasikan fungsi komoditas.
- **Garbage-in, confident-out.** Mitigasi: provenance, measurement gate, unknown state, dan
  confidence threshold.
- **Greenwashing.** Mitigasi: completed-outcome basis, methodology versioning, dan pemisahan
  estimate versus verified impact.
- **Catalogue tidak terawat.** Mitigasi: ownership, approval workflow, versioning, dan
  deprecation.
- **Model/provider drift.** Mitigasi: evaluation suite, configurable model, canary, dan fallback.
- **Pilot tidak menjadi penggunaan rutin.** Mitigasi: ukur repeat production dan outcome, bukan
  jumlah scan.
- **Cross-tenant exposure.** Mitigasi: rules tests, server guard, consent boundary, dan audit.
- **Otomasi merusak inventory.** Mitigasi: append-only ledger, idempotency, transaction, dan
  reversal sebelum auto-decrement.

## Gambaran tujuan akhir

Dalam bentuk paling matang, resaikel dapat menjadi jaringan keputusan circular manufacturing:
material sisa mempunyai identitas dan provenance; workshop mempunyai capability serta capacity;
produk mempunyai template dan bukti proses; buyer mempunyai demand yang berizin; dan setiap
keputusan menghasilkan outcome serta impact yang dapat diaudit.

Batas akhirnya bukan jumlah fitur. Batasnya adalah kualitas evidence. Resaikel boleh berkembang
hingga matching lintas workshop, RFQ, advanced optimization, learning dari actuals, dan verified
impact accounting selama setiap perluasan tetap menjaga fakta fisik, consent, explainability,
auditability, dan approval manusia pada keputusan kritis.
