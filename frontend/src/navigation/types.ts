export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  InterviewerMain: undefined;
  LanguageSelection: undefined;
  RoleSelection: undefined;
  Onboarding: undefined;
  EditProfile: undefined;
  Help: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
};

export type MainStackParamList = {
  HomeTabs: undefined;
  Onboarding: undefined;
  InterviewIntro: { jobId?: string } | undefined;
  Interview: { 
    jobId?: string;
    candidateName: string;
    trade: string;
    phoneNumber: string;
    referencePhoto?: string;
    referenceProfile?: any; // ReferenceProfile from webIdentity (web only)
  };
  Processing: { jobId: string };
  Result: { jobId?: string; resultData: any };
  EditProfile: undefined;
  JobDetail: { jobId: string };
  Help: undefined;
};

export type InterviewerStackParamList = {
  InterviewerTabs: undefined;
  CreateJob: undefined;
  JobApplicants: { jobId: string };
  CandidateDetail: { candidateId: string; jobId: string };
  EditJob: { jobId: string };
  EditProfile: undefined;
  Help: undefined;
};

export type InterviewerTabParamList = {
  Dashboard: undefined;
  Jobs: undefined;
  Applicants: undefined;
  Profile: undefined;
};

export type HomeTabParamList = {
  Home: undefined;
  Jobs: undefined;
  History: undefined;
  Profile: undefined;
};
