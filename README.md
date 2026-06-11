# 🎯 Stratejik Sayı Birleştirme Oyunu

> Kocaeli Üniversitesi – Yazılım Mühendisliği Bölümü · Yazılım Geliştirme Proje Ödevi

Dinamik matris yönetimi, blok düşme mekaniği ve hedef sayı algoritmaları üzerine kurulu, **React Native (Expo)** ile geliştirilmiş mobil bir bulmaca oyunu. Oyuncu, birbirine komşu blokları seçerek toplamları hedef sayıya eşitlemeye çalışır.

---

## 📖 Oyun Nasıl Oynanır?

- Oyun **8 sütun × 10 satır**lık bir tahtada oynanır.
- Ekranın üstündeki **Hedef** sayısına ulaşmak için birbirine **komşu** (yatay, dikey veya çapraz) blokları seç.
- Bir hamlede **en az 2, en fazla 4** blok seçebilirsin.
- Seçilen blokların toplamı hedefe **eşitse** bloklar patlar, üsttekiler aşağı kayar ve boşluklar yeni bloklarla dolar.
- Yukarıdan sürekli yeni bloklar düşer. **Herhangi bir sütun en üste kadar dolarsa oyun biter.**
- Amaç en yüksek skoru yapıp **liderlik tablosuna** girmektir!

---

## ✨ Özellikler

### Temel Mekanikler (Vize Aşaması)
| Özellik | Açıklama |
|--------|----------|
| 🎲 **Oyun Alanı** | 8 × 10 dinamik matris |
| 🧱 **Başlangıç Durumu** | Tahta 3 sıra rastgele blokla başlar |
| ⬇️ **Blok Düşme** | Bloklar yukarıdan birim birim, akıcı animasyonla düşer |
| 🎯 **Hedef Sayı** | Her zaman ulaşılabilir bir kombinasyon üretilir |
| 🔗 **Komşu Seçim** | 8 yönlü komşuluk ile seçim zinciri |
| ✅ **Doğru/Yanlış Kontrol** | Toplam hedefe eşitse hamle başarılı sayılır |

### Tam Oyun Sistemi (Final Aşaması)
| Özellik | Açıklama |
|--------|----------|
| ⚠️ **Ceza Mekanizması** | 3 yanlış seçimde tüm sütunlara yeni blok eklenir |
| 🏆 **Puan Sistemi** | Her sayının sabit bir puan değeri vardır (aşağıdaki tablo) |
| ⏱️ **Süre Azalma** | Puan arttıkça bloklar daha hızlı düşer (5sn → 1sn) |
| 💀 **Oyun Sonu** | Bir sütun dolduğunda oyun biter |
| 🥇 **Liderlik Tablosu** | Skorlar kalıcı olarak saklanır, yüksekten düşüğe sıralanır |

### Puan Tablosu
| Sayı | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|------|---|---|---|---|---|---|---|---|---|
| **Puan** | 1 | 2 | 3 | 5 | 7 | 9 | 12 | 15 | 20 |

### Hız Tablosu (Süre Azalma)
| Toplam Puan | 1–99 | 100–199 | 200–299 | 300–399 | 400+ |
|-------------|------|---------|---------|---------|------|
| **Düşme Süresi** | 5 sn | 4 sn | 3 sn | 2 sn | 1 sn |

---

## 🛠️ Kullanılan Teknolojiler

- **React Native** `0.81` & **Expo SDK** `54`
- **TypeScript** `5.9`
- **React** `19`
- **@react-native-async-storage/async-storage** — liderlik tablosu için kalıcı depolama
- **react-native-safe-area-context** — güvenli alan yönetimi
- **Animated API** — blok düşme animasyonları

---

## 🚀 Kurulum ve Çalıştırma

```bash
# Bağımlılıkları yükle
npm install

# Geliştirme sunucusunu başlat
npx expo start
```

Ardından:
- 📱 **Telefonda çalıştırmak için:** [Expo Go](https://expo.dev/go) uygulamasıyla terminaldeki QR kodu okut
- 🤖 **Android emülatör:** `npm run android`
- 🍎 **iOS simülatör:** `npm run ios`
- 🌐 **Web tarayıcı:** `npm run web`

```bash
# Tip kontrolü
npm run typecheck
```

---

## 📂 Proje Yapısı

```
stratejik-sayi-birlestirme/
├── App.tsx                      # Uygulama giriş noktası
├── src/
│   ├── constants/
│   │   └── game.ts              # Tahta boyutu, puan/renk tabloları, sabitler
│   ├── types/
│   │   └── game.ts              # Block, Board, FallingBlock, LeaderboardEntry tipleri
│   ├── utils/
│   │   ├── game.ts              # Oyun mantığı (komşuluk, hedef üretimi, ceza, oyun sonu)
│   │   └── storage.ts           # AsyncStorage liderlik tablosu işlemleri
│   └── screens/
│       └── GameScreen.tsx       # Ana oyun ekranı ve arayüz
├── app.json
├── package.json
└── tsconfig.json
```

---

## 🧠 Algoritma Notları

- **Hedef sayı üretimi:** Tahtadaki 2–4 uzunluğundaki tüm geçerli komşu zincirlerinin toplamları taranır ve bunlar arasından rastgele bir hedef seçilir. Bu sayede hedef **her zaman ulaşılabilir** olur.
- **Komşuluk kontrolü:** Bir blok, satır ve sütun farkı en fazla 1 olan tüm bloklara komşudur (8 yön).
- **Blok kaydırma (collapse):** Bloklar patladıktan sonra her sütun ayrı ayrı taranır ve mevcut bloklar tabana doğru kaydırılır.

---

## 📝 Lisans

Bu proje Kocaeli Üniversitesi Yazılım Geliştirme dersi kapsamında eğitim amaçlı geliştirilmiştir.
