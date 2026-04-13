# Voice-to-SQL Feature Design

**Date:** 2026-04-13  
**Status:** Approved  
**Author:** Oktay Doğanyıldız

---

## Özet

QueryPlayground bileşenine sesli sorgu özelliği eklenir. Kullanıcı mikrofon butonuna basarak Türkçe veya İngilizce konuşur, transcript gösterilir, onayladıktan sonra AI mevcut `/api/ai/generate-sql` endpoint'i aracılığıyla SQL'e çevirir ve editöre yazar.

---

## Hedef Kullanıcı Akışı

1. QueryPlayground toolbar'da `🎙️` butonuna tıklar
2. `VoiceQueryModal` açılır
3. Kullanıcı dil seçer: `TR` veya `EN`
4. Mikrofon animasyonu başlar, Web Speech API dinlemeye başlar
5. Konuşma dururken transcript kutusu içinde metin görünür
6. Kullanıcı metni isteğe göre düzenleyebilir
7. "SQL'e Çevir" butonuna basar
8. `/api/ai/generate-sql` çağrılır (SmartQuery'deki aynı endpoint)
9. Dönen SQL, QueryPlayground editörüne yazılır
10. Modal otomatik kapanır

---

## Mimari

### Yeni Bileşen: `VoiceQueryModal.jsx`

**Props:**
- `isOpen: boolean` — modalın görünürlüğü
- `onClose: () => void` — modalı kapat
- `onSqlGenerated: (sql: string) => void` — SQL editöre yazılır
- `selectedSchema: string` — AI context için

**Dahili State:**
- `isListening: boolean` — mikrofon aktif mi
- `transcript: string` — tanınan metin (düzenlenebilir)
- `language: 'tr-TR' | 'en-US'` — seçili dil
- `loading: boolean` — AI isteği sürüyor mu
- `error: string | null` — hata mesajı

**Web Speech API Kullanımı:**
```js
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();
recognition.lang = language; // 'tr-TR' veya 'en-US'
recognition.continuous = false;
recognition.interimResults = true;
```

**AI Entegrasyonu:**
- SmartQuery'deki `/api/ai/generate-sql` endpoint'i kullanılır
- API key: `localStorage.getItem('smartquery_api_key')` (mevcut)
- Schema context: `selectedSchema` prop'undan alınır

---

### Değiştirilen Bileşen: `QueryPlayground.jsx`

**Eklenenler:**
- `Mic` ikonu import (lucide-react)
- `voiceModalOpen` state
- Toolbar'a `🎙️` butonu (Trash ile Run arasına)
- `VoiceQueryModal` render

**Değiştirilmeyen:**
- Tüm mevcut SQL execution mantığı
- History, export, tips panel — hiçbiri değişmez

---

## Modal UI Yapısı

```
┌─────────────────────────────────────┐
│  🎙️ Sesli Sorgu         [TR] [EN]   │  ← Header + dil toggle
│─────────────────────────────────────│
│                                     │
│         [ Mic animasyonu ]          │  ← Pulse animasyonu (dinlenirken)
│       "Türkçe dinleniyor..."        │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ Tanınan metin burada        │    │  ← Düzenlenebilir textarea
│  │ görünür ve düzenlenebilir   │    │
│  └─────────────────────────────┘    │
│                                     │
│  [🔄 Tekrar Kaydet] [⚡ SQL'e Çevir] │  ← Action butonları
│                                     │
│  API Key yoksa uyarı gösterilir     │
└─────────────────────────────────────┘
```

---

## Hata Durumları

| Durum | Davranış |
|-------|----------|
| Tarayıcı Speech API desteklemiyor | Modal açılır, "Tarayıcınız desteklemiyor" mesajı |
| Mikrofon izni reddedildi | "Mikrofon erişimi gerekli" hatası |
| Transcript boş | "SQL'e Çevir" butonu disabled |
| API key yok | "SmartQuery ayarlarından API key girin" uyarısı |
| AI isteği başarısız | Kırmızı hata mesajı, modal açık kalır |

---

## Teknik Kısıtlar

- Web Speech API: Chrome, Edge, Safari destekler. Firefox desteklemez.
- Eş zamanlı çoklu dil desteği yok — kullanıcı toggle ile seçer
- API key mevcut `smartquery_api_key` localStorage key'inden okunur
- Yeni backend endpoint gerekmez

---

## Dosya Değişiklikleri

| Dosya | Tür | Açıklama |
|-------|-----|----------|
| `client/src/components/VoiceQueryModal.jsx` | YENİ | Ana ses modal bileşeni |
| `client/src/components/QueryPlayground.jsx` | GÜNCELLE | Mic butonu + modal entegrasyon |
