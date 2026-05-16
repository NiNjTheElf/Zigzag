const RECAPTCHA_ENTERPRISE_SITE_KEY = '6Ld4a-osAAAAAI4WQbqNttxKKgfFlx2rOTcnK-oR';

let recaptchaLoadPromise = null;

function loadRecaptchaEnterprise() {
  if (window.grecaptcha?.enterprise) {
    return Promise.resolve(window.grecaptcha.enterprise);
  }

  if (!recaptchaLoadPromise) {
    recaptchaLoadPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector('script[data-recaptcha-enterprise]');
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(window.grecaptcha.enterprise), { once: true });
        existingScript.addEventListener('error', () => reject(new Error('Could not load reCAPTCHA.')), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = `https://www.google.com/recaptcha/enterprise.js?render=${RECAPTCHA_ENTERPRISE_SITE_KEY}`;
      script.async = true;
      script.defer = true;
      script.dataset.recaptchaEnterprise = 'true';
      script.addEventListener('load', () => resolve(window.grecaptcha.enterprise), { once: true });
      script.addEventListener('error', () => reject(new Error('Could not load reCAPTCHA.')), { once: true });
      document.head.appendChild(script);
    });
  }

  return recaptchaLoadPromise;
}

export async function getRecaptchaEnterpriseToken(action) {
  const enterprise = await loadRecaptchaEnterprise();

  return new Promise((resolve, reject) => {
    enterprise.ready(async () => {
      try {
        const token = await enterprise.execute(RECAPTCHA_ENTERPRISE_SITE_KEY, { action });
        resolve(token);
      } catch (error) {
        reject(error);
      }
    });
  });
}
