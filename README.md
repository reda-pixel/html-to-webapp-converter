# محول HTML إلى WebApp

> تحويل احترافي لملفات HTML إلى مشاريع ويب كاملة قابلة للتشغيل والبناء والنشر.

## ✨ المميزات الرئيسية

✅ **تحليل ذكي للملفات**
- قراءة وتحليل ملفات HTML الكاملة
- استخراج جميع الموارد المرتبطة (CSS, JS, صور، خطوط، SVG، JSON)
- كشف تلقائي لنوع المشروع (HTML/CSS/JS, React, Vite, TypeScript)

✅ **إنشاء هيكل مشروع احترافي**
- تنظيم الملفات بهيكل صحيح
- إصلاح تلقائي للمسارات النسبية والروابط
- الحفاظ على أسماء الملفات والامتدادات

✅ **بناء حقيقي وليس محاكاة**
- تثبيت Dependencies المطلوبة
- تنفيذ build فعلي
- كشف مجلد Output (dist/, build/)
- عرض أخطاء البناء الحقيقية

✅ **التشغيل والمعاينة**
- معاينة حقيقية للمشروع المبني
- تحميل المشروع كملف ZIP
- دعم التعديل والإعادة

✅ **النشر المباشر**
- نشر إلى Netlify باستخدام Access Token
- توليد رابط مباشر للموقع المنشور
- دعم النشر المتكرر والتحديثات

## 🚀 البدء السريع

### المتطلبات
- Node.js 18+
- npm أو yarn

### التثبيت والتشغيل

```bash
# استنساخ المستودع
git clone https://github.com/reda-pixel/html-to-webapp-converter.git
cd html-to-webapp-converter

# تثبيت Dependencies
npm install
cd server && npm install
cd ../client && npm install
cd ..

# تشغيل البيئة الكاملة (Backend + Frontend)
npm run dev
```

أو تشغيل كل جزء على حدة:

```bash
# في terminal منفصل - Backend (المنفذ 5000)
npm run dev:server

# في terminal آخر - Frontend (المنفذ 5173)
npm run dev:client
```

### الوصول للتطبيق
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000/api

## 📁 هيكل المشروع

```
html-to-webapp-converter/
├── client/                 # React + Vite Frontend
│   ├── src/
│   │   ├── components/    # React Components
│   │   ├── App.jsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── server/                # Express.js Backend
│   ├── routes/           # API Routes
│   │   ├── upload.js     # File upload
│   │   ├── analyze.js    # HTML analysis
│   │   ├── build.js      # Project build
│   │   ├── deploy.js     # Netlify deployment
│   │   └── index.js
│   ├── uploads/          # Uploaded files storage
│   ├── index.js          # Main server file
│   └── package.json
│
├── .env.example          # Environment template
├── .gitignore
├── package.json          # Root package config
└── README.md
```

## 🔌 API Endpoints

### تحميل الملفات
```
POST /api/upload
Content-Type: multipart/form-data

Body: { file: <HTML or ZIP file> }
Response: { projectId, filename, size, uploadedAt }
```

### تحليل المشروع
```
POST /api/analyze
Content-Type: application/json

Body: { projectId, filePath }
Response: { resources, projectType, structure }
```

### بناء المشروع
```
POST /api/build
Content-Type: application/json

Body: { projectId }
Response: { buildStatus, logs, outputPath }
```

### النشر إلى Netlify
```
POST /api/deploy/netlify
Content-Type: application/json

Body: { projectId, accessToken }
Response: { deployUrl, deployId, status }
```

## 🛠️ المتغيرات البيئية

انسخ `.env.example` إلى `.env` وأكمل التفاصيل:

```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
MAX_FILE_SIZE=50000000
UPLOAD_DIR=uploads
NETLIFY_API_TOKEN=your_token_here
```

## 📖 الوثائق

### إضافة Support لنوع مشروع جديد

1. **في `server/routes/analyze.js`**: أضف الكشف عن نوع المشروع الجديد
2. **في `server/routes/build.js`**: أضف منطق البناء الخاص به
3. **في الـ Frontend**: أضف UI للنوع الجديد إذا لزم الأمر

### بناء مخصص

إذا كان لديك متطلبات بناء خاصة، يمكنك تعديل `server/routes/build.js` لاستدعاء أوامر مخصصة.

## 🐛 استكشاف الأخطاء

### الملف لا يتم رفعه
- تحقق من حجم الملف (الحد الأقصى 50 MB)
- تأكد من أن نوع الملف HTML أو ZIP
- تحقق من أن مجلد `uploads/` موجود

### البناء يفشل
- افحص سجل البناء في الواجهة
- تحقق من وجود جميع المتطلبات (dependencies)
- تأكد من صحة بنية المشروع

### النشر إلى Netlify لا يعمل
- تحقق من صحة Access Token
- تأكد من أن المشروع تم بناؤه بنجاح
- تحقق من اتصالك بالإنترنت

## 📝 الترخيص

MIT License - انظر [LICENSE](LICENSE) للتفاصيل

## 👨‍💻 المساهمة

المساهمات مرحب بها! يرجى:

1. Fork المستودع
2. أنشئ فرع للميزة الجديدة (`git checkout -b feature/amazing-feature`)
3. قم بـ Commit التغييرات (`git commit -m 'Add amazing feature'`)
4. Push إلى الفرع (`git push origin feature/amazing-feature`)
5. افتح Pull Request

## 📧 التواصل

- **Author**: Reda Pixel
- **GitHub**: [@reda-pixel](https://github.com/reda-pixel)

## 🙏 شكر خاص

شكراً لاستخدامك محول HTML إلى WebApp! نتمنى لك تجربة رائعة. 🚀
