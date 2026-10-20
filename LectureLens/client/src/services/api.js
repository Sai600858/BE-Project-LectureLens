import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: API_BASE,
});

// Attach JWT token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('lecturelens_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-handle expired or invalid tokens
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      const errMsg = String(error.response.data?.error || '');
      if (errMsg.toLowerCase().includes('token') || errMsg.toLowerCase().includes('access')) {
        localStorage.removeItem('lecturelens_token');
        localStorage.removeItem('lecturelens_user');
      }
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: async (email, password) => {
    const res = await api.post('/api/auth/login', { email, password });
    if (res.data.token) {
      localStorage.setItem('lecturelens_token', res.data.token);
      localStorage.setItem('lecturelens_user', JSON.stringify(res.data.user));
    }
    return res.data;
  },
  register: async (name, email, password, role) => {
    const res = await api.post('/api/auth/register', { name, email, password, role });
    if (res.data.token) {
      localStorage.setItem('lecturelens_token', res.data.token);
      localStorage.setItem('lecturelens_user', JSON.stringify(res.data.user));
    }
    return res.data;
  },
  getMe: async () => {
    const res = await api.get('/api/auth/me');
    return res.data.user;
  },
  logout: () => {
    localStorage.removeItem('lecturelens_token');
    localStorage.removeItem('lecturelens_user');
  },
  getCurrentUser: () => {
    const str = localStorage.getItem('lecturelens_user');
    return str ? JSON.parse(str) : null;
  },
};

export const lectureApi = {
  getLectures: async (params) => {
    const res = await api.get('/api/lectures', { params });
    const list = res.data.lectures || [];
    return list.map((l) => ({
      ...l,
      roomId: l.roomId || l.room_id,
      lectureId: l.lectureId || l.id,
    }));
  },
  getLecture: async (id) => {
    const res = await api.get(`/api/lectures/${id}`);
    const lec = res.data.lecture;
    if (lec) {
      lec.roomId = lec.roomId || lec.room_id;
      lec.lectureId = lec.lectureId || lec.id;
    }
    return lec;
  },
  createLecture: async (data) => {
    const res = await api.post('/api/lectures', data);
    const lec = res.data.lecture;
    if (lec) {
      lec.roomId = lec.roomId || lec.room_id;
      lec.lectureId = lec.lectureId || lec.id;
    }
    return lec;
  },
  updateStatus: async (id, status) => {
    const res = await api.put(`/api/lectures/${id}/status`, { status });
    return res.data;
  },
  endLecture: async (id) => {
    const res = await api.post(`/api/lectures/${id}/end`);
    return res.data;
  },
  deleteLecture: async (id) => {
    const res = await api.delete(`/api/lectures/${id}`);
    return res.data;
  },
  clearAllLectures: async () => {
    const res = await api.delete('/api/lectures');
    return res.data;
  },
};

export const aiApi = {
  uploadBoardFrame: async (lectureId, imageBase64, timestamp) => {
    const res = await api.post(`/api/lectures/${lectureId}/board-frame`, { imageBase64, timestamp });
    return res.data.content;
  },
  uploadScreenFrame: async (lectureId, imageBase64, timestamp) => {
    const res = await api.post(`/api/lectures/${lectureId}/screen-frame`, { imageBase64, timestamp });
    return res.data.content;
  },
  getBoardContents: async (lectureId) => {
    const res = await api.get(`/api/lectures/${lectureId}/board-contents`);
    return res.data.contents;
  },
  getScreenContents: async (lectureId) => {
    const res = await api.get(`/api/lectures/${lectureId}/screen-contents`);
    return res.data.contents;
  },
  getSummary: async (lectureId) => {
    const res = await api.get(`/api/lectures/${lectureId}/summary`);
    return res.data.summary;
  },
  generateSummary: async (lectureId) => {
    const res = await api.post(`/api/lectures/${lectureId}/summary`);
    return res.data.summary;
  },
  getStudyNotes: async (lectureId, mode = 'detailed') => {
    const res = await api.get(`/api/lectures/${lectureId}/notes`, { params: { mode } });
    return res.data.notes;
  },
  generateStudyNotes: async (lectureId, mode = 'detailed') => {
    const res = await api.post(`/api/lectures/${lectureId}/notes`, { mode });
    return res.data.notes;
  },
  getTranscript: async (lectureId) => {
    const res = await api.get(`/api/lectures/${lectureId}/transcript`);
    return res.data;
  },
  searchTranscript: async (lectureId, q) => {
    const res = await api.get(`/api/lectures/${lectureId}/transcript/search`, { params: { q } });
    return res.data.matches;
  },
  getChapters: async (lectureId) => {
    const res = await api.get(`/api/lectures/${lectureId}/chapters`);
    return res.data.chapters;
  },
  askLecture: async (lectureId, question) => {
    const res = await api.post(`/api/lectures/${lectureId}/ask`, { question });
    return res.data;
  },
  getQuiz: async (lectureId) => {
    const res = await api.get(`/api/lectures/${lectureId}/quiz`);
    return res.data;
  },
  submitQuiz: async (lectureId, quizId, answers) => {
    const res = await api.post(`/api/lectures/${lectureId}/quiz/submit`, { quizId, answers });
    return res.data;
  },
  getFlashcards: async (lectureId) => {
    const res = await api.get(`/api/lectures/${lectureId}/flashcards`);
    return res.data.flashcards;
  },
  updateFlashcardProgress: async (lectureId, flashcardId, status) => {
    const res = await api.post(`/api/lectures/${lectureId}/flashcards/progress`, { flashcardId, status });
    return res.data;
  },
  getPdfUrl: (lectureId, type) => {
    return `${API_BASE}/api/lectures/${lectureId}/pdf/${type}`;
  },
  uploadRecording: async (lectureId, blob, duration) => {
    const formData = new FormData();
    formData.append('recording', blob, `lecture_${lectureId}.webm`);
    formData.append('duration', duration);
    const res = await api.post(`/api/lectures/${lectureId}/recording`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.recording;
  },
  getRecordingStreamUrl: (lectureId) => {
    return `${API_BASE}/api/lectures/${lectureId}/recording/stream`;
  },
  getRecording: async (lectureId) => {
    const res = await api.get(`/api/lectures/${lectureId}/recording`);
    return res.data.recording;
  },
};

export default api;
