# 🧠 ResearchMind AI

<p align="center">
  <strong>AI-Powered Research Assistant for Discovering, Summarizing, Comparing, and Analyzing Academic Papers</strong>
</p>

<p align="center">
ResearchMind AI helps students, researchers, and professionals discover research papers, generate AI-powered summaries, compare publications, analyze research gaps, and streamline academic research.
</p>

---

# 📖 Overview

ResearchMind AI is a full-stack web application designed to simplify academic research by combining paper discovery with AI-powered analysis.

Instead of spending hours reading multiple research papers, users can search for academic publications, generate concise AI summaries, compare papers side by side, identify research gaps, translate content, generate citations, and access PDFs—all from a single platform.

The project aims to make research faster, smarter, and more accessible.

---

# ✨ Features

- 🔍 Search academic papers
- 🤖 AI-powered paper summaries
- 📊 Compare multiple research papers
- 📚 Automatic citation generation
- 📈 Citation count tracking
- 🧩 Research gap analysis
- 🌍 Translate research papers
- 🔗 Related paper recommendations
- 💾 Save favorite papers
- 📄 Built-in PDF viewer
- 📤 Share research papers
- 🎤 Voice search
- 📱 Fully responsive interface

---

# 🛠️ Tech Stack

## Frontend

- React
- Vite
- JavaScript
- CSS

## Backend

- FastAPI
- Python

## Artificial Intelligence

- Google Gemini API

## Research APIs

- arXiv API

---

# 📂 Project Structure

```text
ResearchMind-AI/
│
├── backend/
│   ├── main.py
│   ├── paper_search.py
│   ├── summary.py
│   ├── citation_count.py
│   ├── test.py
│   ├── requirements.txt
│   └── ...
│
├── frontend/
│   ├── public/
│   ├── src/
│   ├── package.json
│   ├── vite.config.js
│   └── ...
│
├── .gitignore
└── README.md
```

---

# 🚀 Getting Started

## Clone the Repository

```bash
git clone https://github.com/Rohanmunir16/ResearchMind-AI.git
```

---

## Backend Setup

```bash
cd backend

pip install -r requirements.txt

uvicorn main:app --reload
```

Backend runs at:

```
http://127.0.0.1:8000
```

---

## Frontend Setup

```bash
cd frontend

npm install

npm run dev
```

Frontend runs at:

```
http://localhost:5173
```

---

# ⚙️ Environment Variables

Create a `.env` file inside the **backend** folder.

```env
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
```

⚠️ Never commit your actual API key to GitHub.

---

# 📸 Screenshots

Screenshots will be added after deployment.

---

# 🎯 Key Highlights

- Modern React frontend
- FastAPI backend
- Google Gemini AI integration
- Academic paper discovery
- AI-assisted research workflow
- Responsive desktop and mobile design

---

# 🔮 Future Improvements

- User authentication
- Personal research collections
- Cloud synchronization
- Advanced paper filtering
- Dark mode
- PDF export
- AI research assistant with conversational memory

---

# 🤝 Contributing

Contributions are welcome.

If you'd like to improve ResearchMind AI, feel free to fork the repository, create a feature branch, and submit a pull request.

---

# 👨‍💻 Author

**Rohan Munir**

BS Computer Science Student

GitHub: https://github.com/Rohanmunir16

---

## ⭐ Support

If you found this project helpful, consider giving it a **⭐ Star** on GitHub.