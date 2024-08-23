import axios from 'axios';

async function fetchBaiduAccessToken(store, userId) {
  const ACCESS_TOKEN_URL = 'https://aip.baidubce.com/oauth/2.0/token';
  const API_KEY = store.get(`baidu_key_${userId}`) ;
  const SECRET_KEY = store.get(`baidu_secret_${userId}`)  ;
  if (!API_KEY || !SECRET_KEY) return '';
  const accessTokenRes = await axios.post(ACCESS_TOKEN_URL, null, {
    params: {
      grant_type: 'client_credentials',
      client_id: API_KEY.trim(),
      client_secret: SECRET_KEY.trim(),
    },
  });
  return accessTokenRes.data.access_token;
}
async function getBaiduAccessToken(store, userId) {
  const accTokenStr = store.get(`baidu_access_token_${userId}`);
  let accessToken = accTokenStr
    ? JSON.parse(accTokenStr)
    : {
        expiredTime: 0,
        value: '',
      };
  if (accessToken.value && Date.now() < accessToken.expiredTime) {
    return accessToken.value;
  }
  const token = await fetchBaiduAccessToken(store, userId);
  accessToken = {
    expiredTime: Date.now() + 29 * 86400 * 1000, // 29 days
    value: token,
  };
  store.set(`baidu_access_token_${userId}`, JSON.stringify(accessToken));
  return token;
}

export default getBaiduAccessToken;
