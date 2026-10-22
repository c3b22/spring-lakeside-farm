# Art Bible v2: Spring Farm, top-down (8-bit live wallpaper)

v2 แทนที่ v1 (ทิวทัศน์มองด้านข้าง เก็บไว้ที่ `archive/v1-sideview/`)
เปลี่ยนเป็นฟาร์มมุมมองบนแบบ 3/4 บนกริด 16px ตามภาพอ้างอิงที่คุณให้มา
กฎที่ยังคงอยู่จาก skill `pixel-art`: ไม่มี anti-aliasing, hue shifting, selout, integer scaling, ห้าม pillow shading

**หลักใหญ่ของ v2: "สบายตา"** (ตามที่คุณขอ)
ภาพอ้างอิงแน่นมาก ฉากเราจะ **เบากว่า** และมีที่ว่างหายใจ ดูข้อ 6

---

## 1. Pixel grid

| รายการ | ค่า |
|---|---|
| Internal resolution | **640×400** (แก้จาก 640×360: จอจริงคือ 1920×1200, 16:10) |
| Display scale | **3×** integer พอดี 1920×1200 (จอสัดส่วนอื่นจะมีขอบสี `foliage` เข้ม) |
| Tile | **16×16** (40×25 ช่อง) ผัง ทางเดิน แปลง อาคาร จัดตามกริด; บ่อน้ำ ต้นไม้ ขอบพื้นเป็นรูปทรงอิสระ |
| Taskbar | แถบงาน Windows กิน **20 พิกเซลล่าง** (y ≥ 380) ห้ามมีของสำคัญ ให้เป็นขอบป่า |
| Desktop icons | **ซ่อนอยู่แล้ว** ไม่ต้องเว้นโซนซ้าย (ยกเลิกข้อกำหนด x < 190) |
| Pixel scale | ขนาดพิกเซลเดียวทั้งโปรเจกต์ ห้ามขยายบางชิ้น 2× |
| FPS | 30 (animation tick ~8–15 Hz) |

ห้ามเด็ดขาด: `rotate()` มุมที่ไม่ใช่ 90°, scale ทศนิยม, `globalAlpha` < 1, `filter`, `shadowBlur`, gradient, blur, glow

## 2. มุมมองและแสง

- กล้องมองบนเฉียง 3/4: วัตถุที่ตั้งสูง (บ้าน ต้นไม้ รั้ว ไก่) เห็นด้านบนและด้านหน้า พื้นราบ (ทาง แปลง น้ำ หญ้า) เห็นจากบน
- **อาคาร = oblique เห็นผนังข้างขวา**: แกนความลึก z ย้อนไปทางขวา-บนที่ 2:1 (sx = x + z, sy = −y − z/2) หลังคาหน้าจั่ววิ่งซ้าย-ขวา เห็นระนาบหลังคาด้านหน้าเป็นสี่เหลี่ยมด้านขนานเอียงไปทางหลัง และเห็นผนังหน้าจั่วด้านขวาอยู่ในเงา (ramp ลดลงหนึ่งขั้นจากผนังหน้า) ลายกระดานผนังข้างเอียงตามมุมมอง
- **Y-sort**: วัตถุเรียงตามพิกเซลล่างสุด ของที่อยู่ใต้ทับของที่อยู่เหนือ
- แสงทิศเดียว **ซ้ายบน** ตลอดทั้งวัน (ไม่จำลองดวงอาทิตย์เคลื่อน)
- เงา: ตกไปขวา-ล่าง เป็นรูปแข็งโดยลด ramp ลง 1 ขั้น (G3→G2) ไม่ใช้ดำโปร่ง
- ด้านรับแสง = ramp สว่าง (บน/ซ้าย), ด้านหลบแสง = ramp มืด (ขวา/หน้าใต้ชายคา)

## 3. Palette: indexed 64 slot (60 ใช้ + 4 สำรอง)

โค้ดวาดด้วย **palette index** เท่านั้น สลับตารางสีตามเวลา (เช้า/กลางวัน/เย็น/กลางคืน) และฤดู ไม่มี overlay โปร่งใส
ทุก ramp เป็น hue-shifted: เงาเอนไปทางน้ำเงิน/เขียวอมฟ้า/ม่วง ไฮไลต์เอนไปทางเหลือง/ครีม

| Slot | Ramp (มืด → สว่าง) |
|---|---|
| 0–1 ink | `#1b1a2e` `#2d2840` |
| 2–7 grass (6) | `#1f3d3a` `#2f5e3a` `#3f7a3f` `#5f9a3c` `#8fbf45` `#c4dc6a` |
| 8–11 foliage deep (4) | `#12302f` `#1a4a3c` `#27694a` `#3a8a52` (ขอบป่า/พุ่มหนา) |
| 12–16 water (5) | `#24456b` `#2f6a8c` `#3f8fb0` `#7ac0d0` `#c8ece0` |
| 17–21 dirt path (5) | `#7a4a2e` `#a8692f` `#d18f2e` `#e8b84a` `#f6dc88` (ทางดินสีทองแบบในภาพ) |
| 22–24 tilled soil (3) | `#4a2f3a` `#6b4332` `#8a5a3a` |
| 25–29 wood (5) | `#3a2a2e` `#5c3b35` `#8a5a3c` `#b5834a` `#d9b070` |
| 30–33 red roof/barn (4) | `#5e2430` `#8f3338` `#c24a3e` `#e2734f` |
| 34–37 stone (4) | `#3f4568` `#636e8d` `#909cb5` `#c0c8d6` |
| 38–39 lavender | `#5a3a8a` `#9a6ad0` |
| 40–41 blue flower | `#3d5fb0` `#86a8f0` |
| 42–44 blossom pink | `#c95a7d` `#ee8fa5` `#f9cdd3` |
| 45–46 yellow | `#f2c744` `#fbe98a` |
| 47–48 orange | `#e8742c` `#f4a04a` |
| 49 red accent | `#d23a3a` |
| 50–51 cream | `#f6f1e4` `#dcd4c0` |
| 52–53 glow | `#ffb347` `#ffd98a` |
| 54–57 crop greens | `#3f9a6a` `#6cc08a` `#a8e0a0` `#4a8a8a` |
| 58 deep water | `#1a3358` |
| 59–63 | สำรอง |

- ห้ามดำสนิท `#000` และขาวสนิท `#fff` เส้นขอบใช้ `ink` เท่านั้น
- ตารางตามเวลา: ทุก slot มีสีคู่ 4 ชุด (dawn/day/dusk/night) กำหนดในเฟสเวลา; `glow` และไฟหน้าต่างไม่ถูกลดตอนกลางคืน
- ตัวเลขสีเป็นค่าเริ่มต้นที่ผมคำนวณเอง จะปรับหลังเห็นเรนเดอร์จริง

## 4. เส้นขอบและ shading

- **วัตถุตั้ง** (อาคาร ต้นไม้ รั้ว สัตว์ ก้อนหิน พุ่มไม้ใหญ่): outline `ink` ด้านรับแสง (ซ้าย/บน) ใช้ ramp เข้มของวัตถุนั้นแทน (selout)
- **พื้นราบ** (หญ้า ทาง แปลงดิน น้ำ): ไม่มี outline ใช้ขอบ tile 1 พิกเซลสี ramp เข้มกว่าแทน (ขอบทางดินมีขอบหญ้าลาด)
- **ขอบป่าปิดกรอบ**: foliage ramp 4 ชั้น ไม่มี outline ใช้รูปก้อนซ้อน (blob) เหมือน v1
- ห้ามเส้น "doubles", ทุก appendage กว้างอย่างน้อย 2 พิกเซล

## 5. Dithering

- Bayer 4×4 ชั้นเดียว ใช้เฉพาะ: ผืนน้ำ (ไล่ความลึก), การไล่สีทุ่งหญ้าไกล-ใกล้
- ห้ามบน sprite, อาคาร, พืช, สัตว์

## 6. องค์ประกอบ: "สบายตา"

เป้าหมาย: ภาพอ่านจบใน 3 วินาที มีจุดโฟกัสชัด ไม่รก

- **ความหนาแน่น (แก้หลังฟีดแบ็ก "โหวงเกินไป")**: พื้นที่หญ้าเปล่า + ทาง ลดเหลือประมาณ **35–40%** ของจอ ที่เหลือมีของใช้ฟาร์มและต้นไม้เติม แต่ยังเว้นทางเดินให้หายใจ ไม่วางของชิดติดกันทั้งหมด
- **จุดโฟกัสไม่เกิน 3 กลุ่ม** วางห่างกัน: (A) บ้าน (B) โรงนา+คอกสัตว์ (C) แปลงผักกับบ่อน้ำ
- **แปลงผัก 3 แปลง ไม่เกิน** ผืนใหญ่ชนิดเดียวต่อแปลง แถวตรง แต่ความสูงแต่ละต้นต่างกัน ±1 พิกเซล เพื่อไม่ให้เหมือนก๊อปวาง
- **ลดคอนทราสต์ของพื้น**: หญ้าและดินใช้ 2 ขั้นสีติดกัน วัตถุจึงเด่น สีจัดจ้าน (แดง ส้ม ม่วง ฟ้าดอกไม้) รวมกันไม่เกิน ~5% ของจอ
- **ขอบป่า** ปิดกรอบ 4 ด้านเกือบเท่ากัน (ซ้าย/ขวา ~25px, บน ~35px, ล่าง ~45px เพราะแถบงานบังส่วนล่าง) ไม่ให้ป่าด้านใดกินพื้นที่มากจนภาพเอียง
- ไม่ใส่รายละเอียดเล็กจิ๋วต่อเนื่อง (ไม่มีหญ้าเป็นลายสุ่มทั่วจอ มีเพียง tuft เป็นจังหวะห่างๆ)

### ผังคร่าวๆ (640×400, ปรับได้ตอนวางจริง)

```
x:   0   24                                          616 640
y0   |████████ ขอบป่าบน (y 0-40) ███████████████████████|
     |█ | บ้าน(80,60) เล้า(216,72) โรงนา(336,52) คอกสัตว์(464,76)
     |█ |   |ทาง        |ทาง          |ทาง
     |█ |══════ ทางดินหลักแนวนอน y 184-208 ═══════════|█|
     |█ | แปลง1  แปลง2  แปลง3         บ่อน้ำ (460-570, 270-340)
     |█ |
y380 |████ ขอบป่าล่าง (ถึง y≈380) ███  ← แถบงาน Windows บัง y 380-400
```

- **ไม่มีโซนไอคอน** (ซ่อนไอคอนอยู่แล้ว) ฟาร์มเต็มความกว้างจอ
- ระวังนาฬิกา/ถาดระบบมุมขวาล่าง: อยู่ในแถบงานที่ถูกจองไว้
- ทางดินหลักเป็นเส้นนำสายตาไปหาบ้านและโรงนา
- ผังเก็บในไฟล์ data (`scene.js`/JSON) จัดวางด้วยมือ สุ่มเฉพาะ tuft/ดอกไม้ด้วย **seed คงที่**

## 7. ขนาดวัตถุ (px ที่ 640×360)

| วัตถุ | ขนาด | หมายเหตุ |
|---|---|---|
| บ้านไม้ | ~96×80 | หน้าจั่ว มุมเฉียง 3/4 ปล่องไฟ |
| โรงนา | ~112×88 | หลังคาแดง ประตูไม้กากบาท (ออกแบบเอง ไม่ลอกของเกม) |
| เล้าไก่ | ~56×48 | |
| ต้นไม้ใหญ่ | 48–64 | blob 3–4 ชั้น ไม่สมมาตร |
| พุ่ม | 16–24 | |
| พืช | 12–16 ต่อต้น | แปลงละ 1 ชนิด |
| รั้ว | เสา 4×14, ช่วง 16 | ไม้ไม่ตรงเป๊ะ |
| ไก่ / วัว | 10×10 / 22×16 | ไม่มีรายละเอียดหน้าเกิน 2 พิกเซล |
| ดอกไม้ | 3–5 | ไม่มี outline |

- ทดสอบ silhouette: เติมสีเดียวแล้วต้องบอกได้ว่าคืออะไรที่ 1× zoom

## 8. Animation

- เฟรมน้อยแต่คม: ไก่เดิน 4, วัวเอียงหัว/เคี้ยว 2–3, น้ำ 4 เฟรม (150–200 ms)
- ต้นไม้/พืชไหว = **subpixel / color shift** (สลับสีพิกเซลภายใน ไม่เลื่อนทั้งก้อน)
- ควันปล่องไฟ: ก้อน 2–3 พิกเซล ขึ้นทีละพิกเซล ลดสีเป็นขั้น ไม่ใช้ alpha
- กลีบซากุระ/ใบไม้: พิกเซลเดี่ยวหรือคู่ ไม่หมุน
- สัตว์มี anticipation (หยุด หัน แล้วเดิน) ไม่เคลื่อนตลอดเวลา

## 9. เมาส์ (เฟส 4) และ Wallpaper Engine properties

- จุดเรืองแสง 3×3 สี `glow` ตามเมาส์ ไก่วิ่งหนีในรัศมี ~40 พิกเซล หิ่งห้อยบินเข้าหา คลิกแล้วกลีบดอกไม้กระจาย
- ทำงานเฉพาะตอนมองเห็นเดสก์ท็อป
- Properties: ฤดู, ล็อกเวลา (เช้า/เย็น/กลางคืน/ตามจริง), เปิด-ปิดสัตว์, เปิด-ปิดเมาส์

## 10. กฎกัน "AI slop"

1. สีทั้งหมดอยู่ใน 64 slot (ตรวจด้วยสคริปต์นับสีจาก buffer)
2. ทุกพิกเซลทึบ 100% ไม่มี gradient/blur/glow/เงาเบลอ
3. ไม่มีรูปทรงสมมาตรสมบูรณ์ ไม่มีวงกลมเป๊ะ ไม่มีของซ้ำเรียงตรงโดยไม่มีความแปรผัน
4. ความแปรผันเล็กๆ ต้องมีเหตุผล (ต้นไม้โตไม่เท่ากัน ดอกไม้เป็นกลุ่ม) ไม่ใช่สุ่มทั่วจอ
5. ทุกอย่างอยู่บนความหนาแน่นพิกเซลเดียว
6. แสงจากซ้ายบนทุกชิ้น
7. อ่านรูปทรงได้ที่ 1× และ 3×
8. ใช้ภาพ Stardew เพื่อ **เรียนรู้ภาษา** (ความอุ่นของดิน ความหนาของฟอลิเอจ ขอบบ่อโค้ง) ห้ามลอก/trace sprite จริง
9. ตรวจความหนาแน่น: พื้นที่ว่าง ≈ 35–40% ไม่โหวงและไม่รก, ไม่มีมุมจอว่างเกิน ~80×80 พิกเซล

## 11. จุด swap sprite จริง

`assets/overrides/<id>.png` ถ้ามีไฟล์ชื่อตรง id ระบบใช้ไฟล์นั้นแทนการวาดด้วยโค้ด (ต้องมี pixel density เดียวกัน ตรวจ license และบันทึกใน `CREDITS.md`)

## 12. ตรวจรับทุกเฟส

- แคป 3× ของ 4 ช่วงเวลา, รัน palette audit (≤ 64 slot), grep คำสั่งต้องห้าม, ตรวจโซนไอคอนซ้าย
- ใช้ `design:design-critique` กับภาพ และเทียบกับเกณฑ์ "สบายตา" ข้อ 6

## 13. ลำดับเฟส (ปรับจากเดิม)

1. กริด + พื้น (หญ้า ทาง บ่อน้ำ) + ขอบป่า
2. อาคาร (บ้าน โรงนา เล้า) + รั้ว + แปลงผัก + ต้นไม้
3. วงจรเวลา + ตารางสี
4. แอนิเมชัน (น้ำ ต้นไม้ ควัน กลีบดอกไม้)
5. สัตว์ + เมาส์
6. user properties + แพ็กเข้า Wallpaper Engine


## 14. ภาคผนวก v2.1: ฟีดแบ็กรอบเติมความแน่น (ถนน สวน ท่าน้ำ ต้นไม้ ของใช้)

- **ถนน**: ห้ามเส้นตรงและสี่เหลี่ยม ใช้จุดควบคุมแบบ spline ความกว้างแกว่ง ขอบสึก (erode ~25%) มีหญ้ารุกขอบ ก้อนกรวด เชื่อมด้วย "ลานหน้าประตู" และถนนเลียบหน้าอาคาร แทนทางแยกตรง 3 เส้น
- **สวน**: ล้อมด้วยรั้ว มีลานดินอัดแน่นรอบแปลง ทางกลาง ประตูสวน หุ่นไล่กา ถังน้ำ ลัง วัชพืช รังผึ้ง
- **ต้นไม้**: ยกเลิกซากุระ ใช้โอ๊ก แอปเปิล เบิร์ช สน กระจายหลายขนาด
- **ของใช้ฟาร์ม** (`src/props.js`): บ่อน้ำ กองฟืน+ตอไม้, ตู้ไปรษณีย์, ป้ายบอกทาง, เสาไฟ 4 ต้น (ไฟกลางคืนใช้ในเฟส 3), ลัง/ถัง, กองฟาง, รางน้ำ, รังผึ้ง, ม้านั่ง, โต๊ะปิกนิก, รถเข็น
- **ริมน้ำ**: ท่าเรือไม้พร้อมที่นั่งตกปลา เรือพาย เต็นท์ แคมป์ไฟ ท่อนไม้นั่ง
- **ของข้างๆ ขอบป่าล่าง**: แถบงาน Windows บัง y ≥ 380 ของต้องวางสูงกว่า y ≈ 350

## 15. ภาคผนวก v2.2: เงา เส้นขอบ และสัตว์

- **เงาบนพื้นใช้สีเฉพาะ 5 slot** (59–63: เงาหญ้า 3 ระดับ, เงาทางดิน 2 ระดับ) เป็นโทนเย็นกว่าหญ้า/ดินที่อยู่ข้างใต้ เพื่อไม่ให้เงาปนกับหย่อมหญ้าธรรมดา ทุกเงา (ต้นไม้ อาคาร ขอบป่า ของใช้) ใช้ชุดสีนี้ palette เต็ม 64 slot แล้ว
- **เลิกการไล่เงา/แสงด้วย Bayer dither บนพื้น** หย่อมหญ้าสว่างกระจุกใกล้มุมแสง ไม่มีหย่อมเข้มที่ไม่ใช่เงา
- **เส้นขอบ: ไม่ใช้สีดำ** ใช้ outline สีเข้มตามโทนของวัตถุเอง (selout: ขอบซ้าย/บนอ่อนกว่า ขอบขวา/ล่างเข้มกว่า) ตารางอยู่ใน `Palette.OUTLINE` สลับโหมดได้ที่ `?outline=soft` (ค่าเริ่มต้น), `?outline=none` (ไม่มีเส้นขอบ), `?outline=ink` (เส้นหมึกแบบเดิม)
- **สัตว์** (`src/props.js`): วัว 2 (ลายน้ำตาล/ขาวดำ), แกะ 2, หมู 1, ไก่ 6 (ขาว/น้ำตาล), หมา 1, แมว 1 ตอนนี้ยืนนิ่ง จะมีแอนิเมชันในเฟสสัตว์

- **ขอบป่า (แก้หลังฟีดแบ็กว่า "ดูเผา/แย่งโฟกัส")**: เป็นฉากหลังที่มืดและเรียบ สร้างจากทรงพุ่มจริง 3 ชั้นความลึก (ชั้นนอกสุดมืดและแบน ชั้นในใกล้ทุ่งสว่างขึ้นเล็กน้อย) ผสมสนทึบและพุ่มเตี้ยตรงรอยต่อ ขนาดไม่สม่ำเสมอ ไม่มีไฮไลต์ขอบสว่างแบบเดิม
- **แกะ**: ขนเป็นกลุ่มฟู ใบหน้าเล็กสีเข้มตั้งต่ำด้านหน้า มีขนปกหน้าผาก หู และขาเรียวสีเข้ม

- **ขอบป่า v3**: ความหนาขอบแกว่ง 2 สเกลและหนาขึ้นที่มุม ทำให้เป็นลานโค้งมนไม่เป็นสี่เหลี่ยม; สนในป่าไม่มีลำต้น วางไว้หลังพุ่มให้โผล่แค่ยอด (กันต้นไม้ลอย)
- **รั้ว**: แบ่งเป็นช่วงยาวไม่เท่ากัน แต่ละช่วงเหลื่อมแนว 1–2 พิกเซล เสามีออฟเซ็ตเล็กน้อย มีเงาใต้รั้ว
- **รายละเอียดอาคาร**: กระเบื้องแต่ละแผ่นสว่าง/เข้มต่างกัน คราบน้ำฝนครึ่งล่างหลังคา รอยต่อกระดานเหลื่อม ปมไม้ ฝุ่นกระเด็นตรงโคนผนัง เงาข้างหน้าต่าง เงาที่ฐานสองระดับ
- **แปลงสวน**: ดินมีหย่อมชื้น ก้อนดินแห้ง หินเล็ก เงาใต้พืชทุกต้น ป้ายเมล็ดพันธุ์ปักหัวแถว ลาเวนเดอร์บางต้นดอกสีฟ้า

## 16. ภาคผนวก v2.3: เปิดฉากเป็นทุ่งชนบท (แทนที่ข้อกำหนดขอบป่าก่อนหน้า)

- **ยกเลิกป่าล้อมรอบ** ทุ่งหญ้าเต็มจอถึงขอบ ถนนวิ่งออกนอกจอตามธรรมชาติ ขอบจอมีเพียงกลุ่มต้นไม้โปร่งๆ พุ่มไม้ และดอกไม้ป่า (ต้นไม้เล็กด้านล่างโผล่เฉพาะยอดเหนือแถบงาน)
- **บ่อน้ำ** ขยายเป็นประมาณ 150×90 พิกเซลพอสำหรับท่าเรือและเรือ มีปากน้ำ 3 กลีบ
- **ท่าเรือ** (`Props.dock`): ดาดฟ้าไม้มีรอยต่อกระดานและหัวตะปู คานหน้าพร้อมสลัก เสาในน้ำ หัวตัว T มีราวเชือกและห่วงชูชีพ เสาตะเกียง บันไดลงน้ำ ที่นั่งตกปลา ถัง และคันเบ็ด
- **เรือพาย** (`Props.boat`): มองจากบน ตัวเรือทาสีแดง เส้นขาวด้านใน พื้นไม้ ที่นั่งขวางลำ ไม้พายสองเล่ม ผูกเชือกกับท่าเรือ
- **แคมป์** ย้ายไปริมฝั่งขวาของบ่อ: เต็นท์ แคมป์ไฟ ท่อนไม้นั่ง และทางเดินจากถนน

## 17. ภาคผนวก v2.4: ขอบเขตภาพ แอนิเมชัน ชนบท

- **ตัวช่วยดูขอบเขต** (เฉพาะตอนเปิดในเบราว์เซอร์ ซ่อนอัตโนมัติใน Wallpaper Engine): พื้นหลังเป็นลายหมากรุกเทาเข้ม กรอบชมพูรอบ wallpaper จริง มุมทั้งสี่ แถบฟ้าลายเฉียงตรงแถบงาน (20 px ล่าง) ป้ายบอกขนาด 640x400 → ขนาดจริงและสเกล กด G เปิด/ปิด, ?guides=0 ปิด, ?grid=1 ตารางกริด 16 px, ?debug=1 กรอบที่จองไว้
- **แอนิเมชัน** (`src/actors.js`, `Scene.animate`): ฉากนิ่งวาดครั้งเดียว แต่ละเฟรม (20 FPS) คัดลอกฉากนิ่งแล้ววาดของที่ขยับทับ คนรดน้ำผัก คนตัดฟืน คนตกปลา ปลาว่ายเป็นเงา ปลากระโดดพร้อมคลื่น ทุ่นและคลื่น ?static=1 ปิดแอนิเมชัน
- **ผิวหนังคน** ใช้ ramp ของดิน (D2–D4) เพราะ palette ไม่มีสีผิว
- **ขอบจอ**: นาข้าวสาลีมุมบนซ้ายและล่างซ้าย ทุ่งทานตะวันมุมบนขวา รั้วนา กองฟางและเกวียนฟางด้านล่าง ต้นไม้เลี่ยงถนนอัตโนมัติ (ไม่วางบนทาง ลานดิน แปลง)
- **แมว 4 ตัว** (ส้ม เทา ดำ สามสี) ท่านั่งและท่าขดตัว หมาตัวเดียวทรงชัดขึ้น โต๊ะปิกนิกใหม่ (ผ้าตาหมากรุก จาน แก้ว ขนมปัง) กองไฟห่างน้ำ ส่วนต่อเติมอาคารชิดผนังหลักไม่มีช่องว่าง

## 18. ภาคผนวก v2.5: วงจรเวลา (เฟส 3b)

- **ตารางสีตามเวลา**: ไม่ต้องเขียนมือ 4 ชุด ใช้พาเลตกลางวันเป็นฐานแล้ว grade 3 ชุด (dawn, dusk, night) ผ่านฟังก์ชันเดียว (ลดความอิ่มสี คูณโทนสี ดึงเงาไปทางสีเฉพาะ) เว้น slot แสงไฟ (GL0/GL1) ไว้เสมอ จุดคีย์เฟรม 00:00–05:00 ดึก, 06:15 เช้า, 08:00–16:30 กลางวัน, 18:15 เย็น, 20:00 ดึก ผสมค่าสีต่อเนื่องระหว่างกัน
- **แสงกลางคืน = palette bank**: พิกเซลแต่ละจุดมี "ระดับแสง" 0–3 ใน `Engine.light` ระดับ 1–3 ใช้พาเลตอุ่นและสว่างขึ้นสามขั้น ทำให้วงแสงเป็นแถบแข็ง 3 ชั้น ไม่ใช้ dither หรือ alpha ขอบวงแสงแกว่งตาม noise ความแรงแสงค่อยๆ เพิ่ม 18:30–19:45 และค่อยๆ ลด 05:00–05:45
- **ไฟ**: หน้าต่างบ้าน/เล้า ช่องฟางโรงนา ตะเกียงระเบียง เสาไฟ 4 ต้น ติดเมื่อ 18:30 ดับเมื่อ 05:45 (วาดฉากนิ่งใหม่ครั้งเดียวตอนสวิตช์) แคมป์ไฟมีเปลวและวงแสงกระพริบ (ตั้งแต่ 17:30 ถึง 06:30)
- **ชีวิตกลางคืน**: คนทั้ง 3 ทำงาน 06:30–18:30 เท่านั้น สัตว์เลี้ยงนอนหลับ 20:30–05:30 หิ่งห้อย 24 ตัวพร้อมแสงกะพริบ 18:30–06:00
- **ตัวควบคุมดูตัวอย่าง**: `?time=HH:MM|dawn|day|dusk|night` ล็อกเวลา, `?speed=N` เร่งเวลา N นาที/วินาที, กด T หมุนเวลา (นาฬิกาจริง → เช้า → กลางวัน → เย็น → ดึก)

## 19. Agents: roaming animals and villager routines (phase 3c)

- **Navigation** (`src/nav.js`): a 4px grid read off the rendered scene (water, ground-level objects and the foot of tall objects block; obstacles inflated by one cell), A* plus line-of-sight smoothing. Walkers pick targets only in the main connected component, so nothing ever walks onto a road-less island, a field or water. The grid is rebuilt after every `Scene.render`.
- **Animals** (`src/animals.js`, `src/pets.js`, `agents.js`): cow, pig, 2 sheep, 6 chickens, 3 cats and the dog roam the whole farm: idle (graze / peck / sit / groom / lie) -> walk to a random reachable spot -> idle. At night they stop; cats sleep. The black cat stays on the crates, anchored by `Spr.footRow()` so its feet sit on the stack.
- **Villagers**: schedule by minute: work, meals 08:00-08:30 / 12:30-13:00 / 18:00-18:30 (they leave ~10 minutes early), beer 18:30-21:00, asleep 21:00-06:30. Woodcutter and waterer enter the house door, the fisher goes to the tent; at 06:30 they walk out again. Seats: left stool (woodcutter), back bench (waterer), right stool (fisher). Seated pose frames: rest, eat, mug, talk (open mouth + speech bubble, one talker at a time). Meals show plates, the evening shows mugs.
- **Routines**: woodcutter chops 22-36 s, then either pets a random animal (the animal holds still, hearts) or fetches water (well -> draw -> carries the bucket -> pours into the pen trough). Waterer waters 3 random spots in the gaps between the garden plots, then refills at the well. Fisher stays on the dock.
- **Time jumps** (?time=, T key, speed): when the clock moves more than 25 minutes at once, villagers snap to where the schedule says they should be.
- Preview helper: `Agents.debug()` returns the live wanderers and villagers.

## 20. Villager redesign (chars.js)

- Villagers are redrawn from the approved sheet (`charsheet.html` is the design source; `src/chars.js` is generated from its drawing code). Three views like Stardew: down, up, side (side faces right, mirrored for left). Chibi proportions, coloured outlines, three-tone light from the top-left, about 14 colours each.
- Their colours are appended to the palette (`Palette.extend`, slots 64+), so time-of-day grading and lamp banks apply to people too.
- Moving uses front/back/side walk cycles chosen from the walking direction; carrying a bucket always uses the side view. Poses: chop, draw water, pour, water, fish, pet, sit (front view behind the table: rest / eat / drink / talk).
- Picnic table: the back bench's depth is lowered so sitters are drawn in front of it while the table top hides their legs. Walking to a seat goes behind the bench first. The dock and the table are blocked for the nav grid; the fisher walks the deck lane (y=299) on the dock.
- The female painter was designed, then dropped by request.
- Table seating (v2): two villagers on the back bench (front view), one on the front bench (back view, drawn over the table); entry points are behind the back bench (y=321) and in front of the front bench (y=366). Evening: a table lantern with a flickering light pool plus a lamp post by the table. Walking legs sit under the torso; petting is a real crouch (thighs forward, knees bent).

## 21. Phase 4: ambient motion (ambient.js)

- Cloud shadows: two wrapped fractal-noise fields, stretched along the wind and slid past each other, thresholded into ragged billowy streaks (no ellipses); they darken ground and paths through the existing shadow map; they grow in after sunrise and shrink away before dusk. Hard-edged, no alpha; trees and buildings are not shaded.
- Wind: a wave of leaf pixels flickers between neighbouring foliage tones; a slower wave brightens scattered grass pixels; pond glints flicker to the lightest water tone.
- Chimney smoke (7 two-tone puffs rising and drifting east; a stove glow on the first puffs in the evening) and 16 drifting petals.
- Cost about 0.9 ms per frame for everything drawn by Scene.animate. Moving pixels are re-picked whenever the static scene is re-rendered (lamps on/off).
- Cloud shadows now cover everything under them (trees, buildings, animals, people), not only the ground: the shade uses the scene shadow map where it exists, otherwise the nearest darker palette colour. Cost about 3.4 ms per frame for all of Scene.animate.

## 22. Phase 5: mouse interaction

- Pointer mapped to internal coordinates in main.js; handled in agents.js (`Agents.pointer`, `Agents.click`). Works wherever the host forwards mouse events (a plain browser, or Wallpaper Engine with mouse input on).
- Chickens, cats and pigs within about 26 px of a moving pointer run away (2.4x speed for ~2 s); the dog trots over to a pointer that has rested for more than 1.2 s (once every 9 s); a click on an animal holds it still for ~3 s and shows a heart; a click on open ground scatters grain and nearby hens come to peck it.
- Animals still stay on the walkable nav grid; nothing reacts while it is night.

## 23. Visibility switches (phase 6, first part)

- Three groups can be switched on or off independently: villagers (`showpeople`), farm animals = cow, pig, sheep, chickens (`showlivestock`), pets = cats incl. the black cat, and the dog (`showpets`). Wallpaper Engine reads them from `project.json` through `wallpaperPropertyListener.applyUserProperties`; in a browser use `?people=0&livestock=0&pets=0`.
- A hidden group is neither updated nor drawn nor reacts to the mouse. Turning villagers back on snaps them to where the schedule says they should be. The table lantern and mugs go with the villagers.

## 24. Phase 6: Wallpaper Engine properties and packaging

- `project.json` properties: villagers / farm animals / pets (separate checkboxes), cloud shadows, wind + smoke + petals, animals react to the mouse, time of day (follow clock / dawn / day / dusk / night), fast-forward slider (simulated minutes per second), frame rate (20 / 30 / 60, default 30). Seasons are not implemented: only spring exists.
- `sh package.sh` builds `dist/spring-farm` (index.html, project.json, src/*.js). Open it in Wallpaper Engine via Create Wallpaper, or copy it into `wallpaper_engine/projects/myprojects`. No preview image is included; make one in the editor.
- Ripe wheat (top-left) and young wheat (bottom) were rebuilt stalk by stalk: noisy thick and thin patches, drooping ears with awns, dry leaves, tufts of blades, poppies and cornflowers; a gust of colour runs through the ears.

## 25. Release notes (Steam Workshop)

- New property `scalemode`: "Fill the screen" (default; scale = max(w/640, h/400), snapped to a whole number when within 0.1, edges trimmed, bottom 20 rows are spare) or "Pixel-perfect" (whole-number scale, green borders). `?scale=fit` in a browser.
- Everything on screen is drawn by code; no external art, fonts or audio. The description mentions classic farming games, not a specific title.
- The Workshop description states that the wallpaper was made with AI assistance (Claude).
- preview.gif is a 36-frame time-lapse of a whole day (05:00 to 05:00, the quiet night frames thinned out), 640x400, about 800 KB; preview_short.gif is the older 6-second loop.
