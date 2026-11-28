export const PRODUCT_NAME = 'DermaLens AI'
export const PRODUCT_TAGLINE = 'AI-Powered Skin Analysis System'
export const BRAND_LOGO_PATH = '/assets/aistudio/DermaLens_AI_Skin_Analysis_Logo__1__a52a588b.png'

export const ACTIVE_CLINIC_PROFILE_ID = 'demo-doctor'

export const CLINIC_PROFILES = Object.freeze({
  [ACTIVE_CLINIC_PROFILE_ID]: Object.freeze({
    id: ACTIVE_CLINIC_PROFILE_ID,
    isDemo: true,
    doctorName: 'Demo Doctor',
    professionalIdentity: 'Dermatology Consultant (Demo Profile)',
    clinicName: 'DermaLens AI Demonstration Profile',
    profile:
      'Demonstration consultant profile illustrating how DermaLens AI structures preliminary skin observations for specialist review. Not a real medical professional or active clinic.',
    image: '',
  }),
})

export const CLINIC_PROFILE = CLINIC_PROFILES[ACTIVE_CLINIC_PROFILE_ID]

export const PROJECT_CONTACT = Object.freeze({
  name: 'Pratik Tiwari',
  email: '260011713pratik@viva-technology.org',
  phoneDisplay: '+91 8055208985',
  mobile: '+918055208985',
  whatsapp: '8055208985',
  whatsappCountryCode: '91',
})

export const PROJECT_TEAM = Object.freeze([
  Object.freeze({
    id: 'tiwari-pratik-jogendra',
    number: '1',
    name: 'Tiwari Pratik Jogendra',
    rollNo: '29',
    email: '260011713pratik@viva-technology.org',
    phoneDisplay: '+91 8055208985',
    mobile: '+918055208985',
  }),
  Object.freeze({
    id: 'kini-hardik-dnyaneshwar',
    number: '2',
    name: 'Kini Hardik Dnyaneshwar',
    rollNo: '11',
    email: '26001018hardik@viva-technology.org',
  }),
  Object.freeze({
    id: 'mishra-shreyansh-sanjay',
    number: '3',
    name: 'Mishra Shreyansh Sanjay',
    rollNo: '16',
    email: '260011611shreyansh@viva-technology.org',
  }),
])

