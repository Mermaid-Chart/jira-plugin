import axios from 'https://esm.sh/axios';


const httpClient = axios.create({
  baseURL: window.MC_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

httpClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('HTTP Client error:', error);
    return Promise.reject(error);
  }
);

export default httpClient;