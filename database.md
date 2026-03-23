# MongoDB Database Schema
## Smart CV Matching & Recruitment System

Tai lieu nay liet ke cac collection ("bang") va truong du lieu dang duoc dinh nghia trong backend hien tai.

Luu y:
- He thong dung Mongoose, vi vay ten collection thuc te trong MongoDB la dang so nhieu tu dong.
- Moi schema deu bat `timestamps: true` nen co them 2 truong:
  - `createdAt` (Date)
  - `updatedAt` (Date)

## 1) Collection users
Model: `User`
Collection du kien: `users`

| Truong | Kieu | Bat buoc | Rang buoc / Mo ta |
|---|---|---|---|
| `_id` | ObjectId | Co | Khoa chinh tu dong |
| `email` | String | Co | `unique`, `index`, `trim`, `lowercase`, regex email hop le |
| `password` | String | Co | Chuoi hash mat khau, `minlength = 60` |
| `role` | String | Co | Enum: `candidate`, `recruiter`, `admin`; mac dinh `candidate` |
| `fullName` | String | Co | `trim`, `maxlength = 120` |
| `avatar` | String \| null | Khong | URL/avatar path, mac dinh `null` |
| `createdAt` | Date | Co | Tu dong |
| `updatedAt` | Date | Co | Tu dong |

Index chinh:
- `email` (unique + index)

## 2) Collection jobs
Model: `Job`
Collection du kien: `jobs`

| Truong | Kieu | Bat buoc | Rang buoc / Mo ta |
|---|---|---|---|
| `_id` | ObjectId | Co | Khoa chinh tu dong |
| `recruiterId` | ObjectId | Co | Ref `User`, co `index` |
| `title` | String | Co | `trim`, `maxlength = 200` |
| `description` | String | Co | `trim` |
| `requirements` | String | Co | `trim` |
| `cleanText` | String | Co | Van ban chuan hoa cho AI |
| `qdrantId` | String \| null | Khong | Map 1-1 voi point trong Qdrant, co `index` |
| `isAnalyzed` | Boolean | Khong | Mac dinh `false` |
| `keywords` | String[] | Khong | Mac dinh `[]` |
| `category` | String | Co | Enum: `IT`, `Accounting`, `Marketing`; co `index` |
| `location` | String | Khong | Mac dinh `Not specified` |
| `experienceLevel` | String | Khong | Mac dinh `Any` |
| `status` | String | Co | Enum: `active`, `closed`; mac dinh `active` |
| `createdAt` | Date | Co | Tu dong |
| `updatedAt` | Date | Co | Tu dong |

Index chinh:
- `recruiterId`
- `qdrantId`
- `category`

## 3) Collection resumes
Model: `Resume`
Collection du kien: `resumes`

| Truong | Kieu | Bat buoc | Rang buoc / Mo ta |
|---|---|---|---|
| `_id` | ObjectId | Co | Khoa chinh tu dong |
| `candidateId` | ObjectId | Co | Ref `User`, co `index` |
| `fileUrl` | String | Co | URL/duong dan file CV |
| `rawText` | String | Khong | Text trich xuat tu CV, mac dinh chuoi rong |
| `qdrantId` | String \| null | Khong | Map 1-1 voi point trong Qdrant, co `index` |
| `parsedData` | Mixed/Object | Khong | JSON ket qua parse CV, mac dinh `{}` |
| `isAnalyzed` | Boolean | Khong | Mac dinh `false` |
| `createdAt` | Date | Co | Tu dong |
| `updatedAt` | Date | Co | Tu dong |

Index chinh:
- `candidateId`
- `qdrantId`

## 4) Collection applications
Model: `Application`
Collection du kien: `applications`

| Truong | Kieu | Bat buoc | Rang buoc / Mo ta |
|---|---|---|---|
| `_id` | ObjectId | Co | Khoa chinh tu dong |
| `jobId` | ObjectId | Co | Ref `Job`, co `index` |
| `resumeId` | ObjectId | Co | Ref `Resume`, co `index` |
| `status` | String | Co | Enum: `new`, `screening`, `interview`, `hired`, `rejected`; mac dinh `new` |
| `aiStatus` | String | Co | Enum: `pending`, `parsing`, `scoring`, `completed`, `failed`; mac dinh `pending` |
| `aiScores.semanticScore` | Number | Khong | Mac dinh `0` |
| `aiScores.keywordScore` | Number | Khong | Mac dinh `0` |
| `aiScores.hybridScore` | Number | Khong | Mac dinh `0` |
| `aiDetails.matchedKeywords` | String[] | Khong | Mac dinh `[]` |
| `aiDetails.missingKeywords` | String[] | Khong | Mac dinh `[]` |
| `createdAt` | Date | Co | Tu dong |
| `updatedAt` | Date | Co | Tu dong |

Index chinh:
- `{ jobId: 1, status: 1 }`
- `{ jobId: 1, aiStatus: 1 }`
- Unique compound: `{ jobId: 1, resumeId: 1 }`

## 5) Collection systemconfigs
Model: `SystemConfig`
Collection du kien: `systemconfigs`

| Truong | Kieu | Bat buoc | Rang buoc / Mo ta |
|---|---|---|---|
| `_id` | ObjectId | Co | Khoa chinh tu dong |
| `key` | String | Co | `unique`, `index`, `trim` |
| `value` | Mixed/Object | Co | Gia tri cau hinh theo tung key |
| `createdAt` | Date | Co | Tu dong |
| `updatedAt` | Date | Co | Tu dong |

Key cau hinh dang su dung:
- `featureConfig`
- `languageConfig`
- `llmConfig`
- `promptConfig`
- `apiKeysConfig`

## 6) Quan he du lieu tong quan
- `users (1) -> (n) jobs` qua `jobs.recruiterId`
- `users (1) -> (n) resumes` qua `resumes.candidateId`
- `jobs (1) -> (n) applications` qua `applications.jobId`
- `resumes (1) -> (n) applications` qua `applications.resumeId`
- `applications` unique theo cap `(jobId, resumeId)` de tranh ung tuyen trung lap cung mot CV cho cung JD.

## 7) Ghi chu bao cao
- He thong hien tai tap trung MongoDB cho du lieu nghiep vu va cau hinh ung dung.
- Du lieu vector embedding duoc luu tai Qdrant. Chi tiet duoc liet ke o muc 8 ben duoi.

## 8) Du lieu vector embedding luu tai Qdrant

Luu y:
- Qdrant la vector database rieng, khong phai collection MongoDB.
- Moi ban ghi Job/Resume trong MongoDB duoc map 1-1 sang mot point trong Qdrant qua truong `qdrantId`.
- Cau hinh vector hien tai:
  - `vector_size = 384`
  - `distance = Cosine`

### 8.1) Collection jobs_vectors
Collection mac dinh: `jobs_vectors`

| Thanh phan | Kieu | Mo ta |
|---|---|---|
| `point_id` | String (UUID) | Chinh la `jobs.qdrantId` |
| `vector` | float[] (384) | Embedding cua noi dung JD |
| `payload.mongoId` | String | Map ve `jobs._id` |
| `payload.category` | String | Danh muc cong viec (`IT`, `Accounting`, `Marketing`) |
| `payload.status` | String | Trang thai Job (`active`/`closed`) |

Nguon cap nhat:
- Khi tao/cap nhat Job (`createJob`, `updateJobById`) se upsert point vao Qdrant neu co embedding.
- Khi Job dong (`status=closed`) hoac bi xoa, point se bi xoa khoi Qdrant.

### 8.2) Collection resumes_vectors
Collection mac dinh: `resumes_vectors`

| Thanh phan | Kieu | Mo ta |
|---|---|---|
| `point_id` | String (UUID) | Chinh la `resumes.qdrantId` |
| `vector` | float[] (384) | Embedding cua noi dung CV |
| `payload.mongoId` | String | Map ve `resumes._id` |
| `payload.candidateId` | String | Map ve `resumes.candidateId` |
| `payload.isAnalyzed` | Boolean | Co da qua buoc phan tich hay chua |

Nguon cap nhat:
- Khi tao/cap nhat Resume (`createResume`, `updateResumeById`) se upsert point vao Qdrant neu co embedding.
- Khi Resume bi xoa, point se bi xoa khoi Qdrant.

### 8.3) Luong truy van vector
- Search CV theo Job vector: tim trong `resumes_vectors`.
- Search Job theo CV vector: tim trong `jobs_vectors`.
- API search hien tai bat `with_payload = true` de tra kem metadata payload.
