import doctorImage from '../assets/4b8b43cf-34a3-43ae-8f2a-b5806910dd9f.jpg'

export const PRODUCT_NAME = 'Dermalens AI'

export const ACTIVE_CLINIC_PROFILE_ID = 'dr-ashutosh-konwar'

export const CLINIC_PROFILES = Object.freeze({
  [ACTIVE_CLINIC_PROFILE_ID]: Object.freeze({
    id: ACTIVE_CLINIC_PROFILE_ID,
    doctorName: 'Dr. Ashutosh Konwar',
    qualifications: Object.freeze(['MD Dermatologist']),
    specialization: '',
    experience: '',
    email: 'ash.kuv@gmail.com',
    phone: '9864253919',
    whatsapp: '919864253919',
    countryCode: '+91',
    clinicName: 'The Derma Clinic',
    address: 'Ajanta Tower, Andheri East, Mumbai',
    city: 'Mumbai',
    profile: 'The clinic which focuses on your skin, not your money',
    image: doctorImage,
  }),
})

export const CLINIC_PROFILE = CLINIC_PROFILES[ACTIVE_CLINIC_PROFILE_ID]

export const PROJECT_CONTACT = Object.freeze({
  name: 'Pratik Tiwari',
  email: '2600111713pratik@viva-technology.org',
  mobile: '8055208985',
  whatsapp: '8055208985',
  whatsappCountryCode: '91',
})
