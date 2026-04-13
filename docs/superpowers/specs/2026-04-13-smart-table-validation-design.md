# Smart Table Validation & "Bunu mu demek istediniz?" Feature

## Problem

SmartQuery AI, doğal dil sorgularından SQL üretirken HANA'da var olmayan tablo isimleri hallucinate ediyor. Örneğin kullanıcı "satış verilerini listele" dediğinde AI `SATIS_VERILERI` üretiyor ama gerçek tablo `SATIS_DATA` olabilir. Kullanıcı çalıştırınca `invalid table name` hatası alıyor.

## Çözüm

İki katmanlı koruma:
1. **Önleme**: AI'ya gerçek tablo listesi gönderilerek hallucination azaltılır
2. **Düzeltme**: Üretilen SQL doğrulanır, hatalı tablolar için "Bunu mu demek istediniz?" önerisi gösterilir

## Yaklaşım

**Backend-Driven (Yaklaşım B)**: Tüm doğrulama ve öneri logic'i backend'de. Frontend sadece UI render eder.

## Mimari

```
[SmartQuery UI]
    │
    ├─ Schema Seçici dropdown (yeni)
    │     → schema seçilince GET /api/tables/list?schema=X
    │     → tablo listesi frontend state + cache (24h TTL)
    │     → bağlantı değişince cache flush
    │     → manuel refresh butonu
    │
    └─ POST /api/ai/generate-sql
           { apiKey, prompt, schema, tableList }
                    │
           [ai.js route - backend]
                    │
                    ├─ 1. Sistem prompt'una tablo listesi enjekte edilir
                    │     "YALNIZCA şu tablolardan birini kullan: [...]"
                    │
                    ├─ 2. AI SQL üretir
                    │
                    ├─ 3. SQL parse → tablo isimleri çıkarılır (regex)
                    │
                    ├─ 4. Her tablo HANA SYS.TABLES / SYS.VIEWS'a karşı doğrulanır
                    │
                    ├─ 5a. Bulunamazsa → fuzzy match (Levenshtein, tablo listesine karşı)
                    │
                    └─ 5b. Fuzzy sonuç yoksa → AI'a tekrar sorulur:
                          "Bu tablolar var: [...]. SATIS_VERILERI hangisine karşılık gelir?"

           Response:
           {
             sql: "SELECT ...",
             explanation: "...",
             invalidTables: [
               {
                 name: "SATIS_VERILERI",
                 suggestions: [
                   { table: "SATIS_DATA", source: "fuzzy", score: 0.82 },
                   { table: "REVENUE_FACTS", source: "ai" }
                 ]
               }
             ]
           }
```

## Backend Değişiklikleri

### Yeni Endpoint: GET /api/tables/list

- **Route**: `server/routes/tables.js`
- **Parametre**: `?schema=FAIR_TRAINING`
- **Döner**: `{ tables: ["SATIS_DATA", "MUSTERI", ...] }`
- **Kaynak**: `SELECT TABLE_NAME FROM SYS.TABLES WHERE SCHEMA_NAME = ? UNION SELECT VIEW_NAME FROM SYS.VIEWS WHERE SCHEMA_NAME = ?`

### Yeni Servis: server/services/tableValidationService.js

Sorumlulukları:
1. **extractTableNames(sql)** — SQL'den FROM, JOIN, INTO sonrası tablo isimlerini regex ile çıkarır
2. **validateTables(tableNames, schema)** — HANA'da varlığını kontrol eder
3. **fuzzyMatch(invalidName, validTableList)** — Levenshtein distance ile en yakın 3 tabloyu döner (score > 0.5)
4. **aiSuggest(invalidName, validTableList, aiService)** — Fuzzy sonuç yoksa AI'a sorar

### Güncellenmiş: POST /api/ai/generate-sql

Request body'ye `tableList` eklenir. Mevcut akış:
1. `aiService.generateSql()` çağrılmadan önce, sistem prompt'una tablo listesi enjekte edilir
2. SQL üretildikten sonra `tableValidationService` çağrılır
3. Response'a `invalidTables` array'i eklenir

## Frontend Değişiklikleri

### SmartQuery.jsx

1. **Schema seçici dropdown** — Bağlantı varsa schema listesi çekilir (GET /api/schemas/list veya mevcut endpoint)
2. **Tablo listesi cache** — `{ key: "host:port/SCHEMA", value: [...tables], timestamp }` objesi state'de tutulur. 24 saat TTL. `connectionStore` subscribe edilir, bağlantı değişince flush.
3. **Refresh butonu** — Schema seçicinin yanında, cache'i temizleyip tekrar çeker
4. **Prompt gönderimi** — `tableList` alanı request body'ye eklenir
5. **InvalidTables UI** — SQL bloğunun altında inline uyarı banner:
   ```
   ⚠️ SATIS_VERILERI bulunamadı.
   Bunu mu demek istediniz?  [SATIS_DATA]  [REVENUE_FACTS]
   ```
6. **Chip tıklama** — Tıklanan tablo ismi SQL'de replace edilir, SQL otomatik güncellenir
7. **localStorage** — Son seçilen schema `localStorage('smartquery_schema')` ile saklanır

## Eşleşme Stratejisi

1. **Fuzzy match (Levenshtein)**: Tablo listesine karşı string benzerliği. Score > 0.5 olan en yakın 3 tablo döner.
2. **AI semantic match**: Fuzzy sonuç yoksa AI'a sorulur: "Bu tablolar mevcut: [...]. Kullanıcı X tablosunu kastetmiş olabilir, hangisi en uygun?"
3. Sıralama: Fuzzy sonuçlar önce, AI sonuçları sonra gösterilir.

## Cache Stratejisi

- **Key**: `${host}:${port}/${schema}`
- **TTL**: 24 saat
- **Invalidation**: Bağlantı değişince tüm cache flush
- **Manuel refresh**: Refresh butonu ile anında yenileme
- **Storage**: React state (sessionStorage değil — component unmount'ta kaybolması sorun değil, her oturumda bir kez çekmek yeterli)

## Kararlar

| Karar | Seçim | Neden |
|-------|-------|-------|
| Doğrulama noktası | Backend (Yaklaşım B) | SQL parse backend'de daha güvenilir |
| İyileştirme türü | Önleme + Düzeltme (C) | İki katmanlı koruma |
| Eşleşme | Fuzzy + AI fallback (C) | Yazım benzerliği + anlam bazlı |
| Schema kapsamı | Kullanıcı seçimi (C) | API cost optimizasyonu |
| Öneri UI | Inline uyarı + chip (A) | Chat akışını bozmaz |
| Cache TTL | 24 saat | Tablo yapısı günde bir değişir |

## Kapsam Dışı (İlk Versiyon)

- Sütun ismi doğrulama (v2'de eklenebilir)
- Sütun listesini AI'ya gönderme (v2'de eklenebilir)
- Streaming/real-time doğrulama
