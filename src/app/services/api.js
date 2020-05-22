import axios from 'axios';

let baseURL = 'https://dadosabertos.camara.leg.br/api/v2/';

const api = axios.create({
  baseURL,
});

export default api;
