# Focus Party — Yii2 API + React (คู่มือภาษาไทย)

```
focus-party/
├── components/Rules.php   ← สูตรเกมทั้งหมด (EXP, ระยะต้นไม้, บอส, เวลาพัก)
├── controllers/           ← API ทุกตัว (/api/...)
├── models/                ← User, Room, RoomMember, Boss, RoomMessage, FriendRequest, Garden
├── migrations/            ← สร้างตาราง + ข้อมูลตัวอย่าง
├── config/web.php         ← URL ของ API ทั้งหมด
├── web/                   ← index.php ของ Yii + React ที่ build แล้ว (ต้อง commit)
└── frontend/              ← โค้ด React
```

## บัญชีตัวอย่าง (หลังรัน migrate)

| ชื่อผู้ใช้ | รหัส | ใช้โชว์อะไร |
|---|---|---|
| `admin` | `Admin1234` | แอดมิน Lv.30 ปรับเลเวลตัวเองได้ เข้าห้องบอสได้ |
| `focus_demo1` | `Focus1234` | Lv.7 สวน 14 ต้น (2 แปลง มีต้นตาย 1 ต้น) มีเพื่อน มีคำขอเป็นเพื่อนรออยู่ |
| `focus_demo2` | `Focus1234` | เพื่อนของ demo1 · โฮสต์ห้องโหมดโฟกัส (ปิดแชท) |
| `focus_demo3` | `Focus1234` | Lv.32 โฮสต์ห้องบอส Baby Pest กับห้องมีแชท + เวลาพัก |
| `focus_demo4` | `Focus1234` | ปิดรับคำขอเป็นเพื่อน |

---

## 1. รันในเครื่องตัวเอง (XAMPP)

ต้องมี: PHP 8.2+, MariaDB/MySQL, Composer, Node.js

```bash
# 1) ติดตั้ง
composer install
cd frontend && npm install && cd ..

# 2) สร้างฐานข้อมูลชื่อ focus_party (ใน phpMyAdmin ก็ได้) แล้วก๊อป .env
copy .env.example .env        # Mac/Linux: cp .env.example .env
#    แก้ DB_USERNAME / DB_PASSWORD ใน .env ให้ตรงกับเครื่อง (XAMPP ปกติ root ไม่มีรหัส)

# 3) สร้างตาราง + ข้อมูลตัวอย่าง
php yii migrate

# 4) เปิด API
php yii serve --port=8080
```

อีกหน้าต่าง terminal:

```bash
cd frontend
npm run dev
```

เปิด http://localhost:5173

- `npm run dev` ใช้ **ข้อมูลจำลอง (mock)** เป็นค่าเริ่มต้น ถ้าจะต่อ API จริงที่เปิดไว้ ให้สร้างไฟล์ `frontend/.env` ใส่
  `VITE_USE_MOCK=false` แล้วรัน `npm run dev` ใหม่
- XAMPP บน Windows ถ้าพิมพ์ `php` ไม่ได้ ให้ใช้ `C:\xampp\php\php.exe` แทน เช่น `C:\xampp\php\php.exe yii migrate`

## 2. Build React (ทุกครั้งที่แก้หน้าเว็บ)

```bash
cd frontend
npm run build
```

ไฟล์ไปอยู่ใน `web/` (`web/index.html`, `web/app/`, รูป, เพลง) **ต้อง commit ด้วย** เพราะเซิร์ฟเวอร์ไม่มี Node
`npm run build` ต่อ API จริงเองอัตโนมัติ

## 3. เอาขึ้น GitHub (ใช้ชื่อเราเป็นคน commit จะได้ขึ้นในโปรไฟล์)

**แบบ GitHub Desktop (ง่ายสุด)**
1. File → **Add local repository** → เลือกโฟลเดอร์ `focus-party` → จะขึ้นว่ายังไม่ใช่ repo ให้กด **create a repository**
2. ช่อง Summary พิมพ์ `Focus Party` → กด **Commit to main**
3. กด **Publish repository** (เอาติ๊ก Keep this code private ออก ถ้าจะโชว์ในพอร์ต)

**แบบพิมพ์คำสั่ง**
```bash
git init -b main
git add .
git commit -m "Focus Party"
git remote add origin https://github.com/<ชื่อเรา>/focus-party.git
git push -u origin main
```

ไฟล์ `.env` จะไม่ขึ้น GitHub (กันไว้ใน `.gitignore` แล้ว)

## 4. Deploy ฟรี: Render (เว็บ) + TiDB Cloud (ฐานข้อมูล)

**ฐานข้อมูล: TiDB Cloud** (ฟรี ไม่ต้องใช้บัตร ใช้คำสั่งแบบ MySQL ได้)
1. สมัคร https://tidbcloud.com → สร้าง **Starter** (ฟรี) เลือก region ใกล้ไทย เช่น Singapore
2. เปิด **SQL Editor** พิมพ์ `CREATE DATABASE focus_party;` แล้วกดรัน
3. กด **Connect** จดค่า Host, Port (4000), User (หน้าตาแบบ `xxxx.root`), Password

**เว็บ: Render**
1. สมัคร https://render.com ด้วยบัญชี GitHub
2. **New → Blueprint** → เลือก repo `focus-party` (Render อ่าน `render.yaml` เอง)
3. กรอก 3 ช่อง:
   - `DB_DSN` = `mysql:host=<Host จาก TiDB>;port=4000;dbname=focus_party`
   - `DB_USERNAME` = User จาก TiDB
   - `DB_PASSWORD` = Password จาก TiDB
4. กด Apply รอ build ประมาณ 5 นาที ตอนเริ่มระบบจะสร้างตารางกับข้อมูลตัวอย่างให้เอง
5. เปิดลิงก์ที่ Render ให้ (`https://focus-party-xxxx.onrender.com`) ต่อท้าย `/api/test` ต้องเห็น `Focus Party API is running!`

หลังจากนี้ทุกครั้งที่ push ขึ้น GitHub (branch main) Render จะ deploy ใหม่ให้เอง
ถ้าแก้หน้าเว็บ อย่าลืม `npm run build` ก่อน commit

**ข้อควรรู้**
- Render ฟรีจะหลับถ้าไม่มีคนเข้า 15 นาที คนแรกที่เข้าต้องรอประมาณ 1 นาที (ก่อนส่งลิงก์ให้ใครดู เปิดทิ้งไว้ก่อน)
- ห้ามเอา `.env` ขึ้น GitHub (ตั้งไว้ใน `.gitignore` แล้ว) รหัสฐานข้อมูลใส่ใน Render อย่างเดียว

### เช็คหลัง deploy
- [ ] `/api/test` เห็น `Focus Party API is running!`
- [ ] หน้า Login ไม่มีบรรทัด "Mock mode"
- [ ] ล็อกอิน `admin` / `Admin1234` ได้ แล้วเปิดห้อง → อีกเครื่องจอยได้ → เริ่ม → แชทเห็นกัน
- [ ] รีเฟรชหน้าห้อง / สวน ไม่ขึ้น 404

---

## API ทั้งหมด

ทุกคำตอบเป็น `{"data": ...}` · error เป็น `{"message": "...", "errors": {"ช่อง": ["ข้อความ"]}}` · เวลาเป็น unix วินาที
ทุกตัวยกเว้น register / login / test ต้องส่ง `Authorization: Bearer <token>`

| Method | URL | ทำอะไร |
|---|---|---|
| GET | `/api/test` | เช็คว่า API ทำงาน |
| POST | `/api/auth/register` | สมัคร `{username, password, display_name}` |
| POST | `/api/auth/login` | ล็อกอิน (ใช้ token เดิม เข้าหลายเครื่องได้) |
| GET | `/api/me` | ข้อมูลตัวเอง |
| PUT | `/api/me/avatar` | บันทึกตัวละคร + สัตว์เลี้ยง |
| PUT | `/api/me/settings` | `allow_friend_requests`, `garden_theme` |
| GET | `/api/me/garden` | ต้นไม้ในสวน |
| POST | `/api/me/garden/water` | รดน้ำทุกต้น |
| PUT | `/api/me/garden/{room_id}` | ตั้งชื่อต้นไม้ |
| GET | `/api/rooms?status=waiting\|running\|finished` | รายการห้อง |
| POST | `/api/rooms` | สร้างห้อง |
| GET | `/api/rooms/{id}` | รายละเอียดห้อง (สมาชิก, เลือดบอส, ระยะต้นไม้) |
| POST | `/api/rooms/{id}/join` · `start` · `leave` · `claim` | เข้า / เริ่ม (โฮสต์) / ขอตัวก่อน / เก็บผล |
| GET | `/api/rooms/{id}/messages?after_id=0` | ข้อความแชท (หน้าเว็บดึงทุก 3 วินาที) |
| POST | `/api/rooms/{id}/messages` | ส่งข้อความ `{body}` |
| GET | `/api/bosses` · `/api/bosses/{id}` | แม่แบบบอส |
| GET | `/api/friends` | เพื่อน + คำขอเข้า/ออก |
| POST | `/api/friends/requests` | ส่งคำขอ `{user_id}` |
| POST | `/api/friends/requests/{id}/accept` · `decline` | รับ / ปฏิเสธหรือยกเลิก |
| DELETE | `/api/friends/{user_id}` | ลบเพื่อน |
| GET | `/api/users/{id}/garden` | เยี่ยมสวนเพื่อน (เพื่อนเท่านั้น) |
| PUT | `/api/admin/level` | แอดมินตั้งเลเวลตัวเอง `{level: 1–60}` |

## ตารางในฐานข้อมูล

| ตาราง | เก็บอะไร |
|---|---|
| `users` | บัญชี, EXP, ตัวละคร (JSON รวมสัตว์เลี้ยง), role, รับคำขอเพื่อนไหม, ธีมสวน |
| `rooms` | ห้อง: เวลา, ต้นไม้, ธีม, แชท, เวลาพัก, บอสของห้อง (ชื่อ + HP), โบนัสเก็บผล |
| `room_members` | ใครอยู่ห้องไหน + **ต้นไม้ในสวน** (ระยะ, ชื่อ, รดน้ำล่าสุด, การชุบชีวิต) |
| `bosses` | แม่แบบบอส (Baby Pest 60, Pest Worm 120, Giant Pest 320 HP) |
| `room_messages` | แชทในห้อง |
| `friend_requests` | คำขอเป็นเพื่อน (pending / accepted) |

## กฎเกม (components/Rules.php — ตรงกับ frontend/src/rules.js)

- ห้องยาว 15–180 นาที (ห้องบอส 15–360) · ห้องบอสต้อง Lv.30+
- EXP = นาทีที่โฟกัส ÷ 2 ปัดขึ้น · ออกก่อนครึ่งเวลา −2 (EXP ไม่ติดลบ)
- เก็บผลภายใน 10 นาทีหลังจบ: ห้องธรรมดา + โบนัส (60 นาทีขึ้นไป +10, สั้นกว่านั้นสุ่ม 20% ได้ 1–10)
  ห้องบอส + โบนัสเมื่อบอสตาย (นาที ÷ 10 ปัดขึ้น, 100 นาทีขึ้นไป ×2)
- ต้นไม้: ห้องธรรมดาขึ้นระยะ 2 ที่ครึ่งเวลา ระยะ 3 เมื่ออยู่จนจบ · ห้องบอสขึ้นทุก ⅓ ของเลือด ร่างชนะเมื่อบอสตาย
- บอสโดน 1 ดาเมจ ต่อนาทีโฟกัส ต่อคน · บอสเป็นของแต่ละห้อง
- เวลาพัก (ห้อง 50 นาทีขึ้นไป): พักทุก ๆ น้อยกว่าเวลาห้อง เป็นเวลาไม่เกิน 20 นาที ไม่นับเป็นเวลาโฟกัส
- โฮสต์ออก → โฮสต์ตกเป็นของคนที่เข้าห้องก่อนที่สุดที่ยังอยู่
- สวน: ไม่รดน้ำเกิน 30 / 60 / 90 / 180 วัน (ระยะ 1 / 2 / 3 / ชนะบอส) ต้นตาย ·
  รดน้ำ 5 วัน (คนละวัน) ภายใน 30 วัน ต้นฟื้น
