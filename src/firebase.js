import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAVd3PtltEPMdmIsjvjMKPxaTuJOxwF1go",
  authDomain: "marcador-live-b1ec2.firebaseapp.com",
  projectId: "marcador-live-b1ec2",
  storageBucket: "marcador-live-b1ec2.firebasestorage.app",
  messagingSenderId: "81540719358",
  appId: "1:81540719358:web:952351d16cfcf244cc3baf"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
