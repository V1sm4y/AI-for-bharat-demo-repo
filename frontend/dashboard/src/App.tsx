import React, { useEffect, useMemo, useState } from 'react';
import {
  Briefcase,
  CheckCircle,
  ChevronRight,
  Filter,
  LayoutDashboard,
  LogOut,
  Plus,
  Search,
  Trash2,
  Users,
  XCircle,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { supabase } from './lib/supabase';

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: 'candidate' | 'employer' | 'admin' | null;
};

type JobForm = {
  id?: string;
  title: string;
  description: string;
  trade: string;
  experience_required: string;
  location: string;
  skills_required: string;
  openings: string;
  company_name: string;
  company_description: string;
};

const emptyJobForm: JobForm = {
  title: '',
  description: '',
  trade: '',
  experience_required: '',
  location: '',
  skills_required: '',
  openings: '1',
  company_name: '',
  company_description: '',
};

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    bootstrap();
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionUser(session?.user ?? null);
      if (session?.user) {
        loadProfileAndData(session.user.id);
      } else {
        setProfile(null);
        setJobs([]);
        setCandidates([]);
        setLoading(false);
      }
    });

    return () => data.subscription.unsubscribe();
  }, []);

  async function bootstrap() {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user ?? null;
    setSessionUser(user);
    if (user) {
      await loadProfileAndData(user.id);
    } else {
      setLoading(false);
    }
  }

  async function loadProfileAndData(userId: string) {
    setLoading(true);
    const { data: profileData, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .eq('id', userId)
      .single();

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setProfile(profileData);
    if (profileData?.role === 'admin' || profileData?.role === 'employer') {
      await fetchData(userId, profileData.role);
    }
    setLoading(false);
  }

  async function fetchData(userId = sessionUser?.id, role = profile?.role) {
    if (!userId) return;
    const isAdmin = role === 'admin';

    const jobsQuery = supabase
      .from('jobs')
      .select('*, companies(id, company_name, description), applications(count)')
      .order('created_at', { ascending: false });

    if (!isAdmin) jobsQuery.eq('created_by', userId);

    const { data: jobsData, error: jobsError } = await jobsQuery;
    if (jobsError) {
      setMessage(jobsError.message);
      return;
    }

    const jobIds = (jobsData || []).map((job) => job.id);
    let appsData: any[] = [];
    let interviewData: any[] = [];

    if (jobIds.length > 0) {
      const { data: applications, error: appsError } = await supabase
        .from('applications')
        .select('*, profiles(full_name, email, phone, trade, district), jobs(title, company_id)')
        .in('job_id', jobIds)
        .order('created_at', { ascending: false });

      if (appsError) {
        setMessage(appsError.message);
        return;
      }

      const { data: interviews, error: interviewsError } = await supabase
        .from('interviews')
        .select('id, user_id, job_id, average_score, classification, confidence_score, fitment, feedback, transcript')
        .in('job_id', jobIds);

      if (interviewsError) {
        setMessage(interviewsError.message);
        return;
      }

      appsData = applications || [];
      interviewData = interviews || [];
    }

    setJobs(jobsData || []);
    setCandidates(
      appsData.map((app) => ({
        ...app,
        interview: interviewData.find((item) => item.user_id === app.user_id && item.job_id === app.job_id) ?? null,
      }))
    );
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  if (loading) {
    return <div className="center-screen">Loading dashboard...</div>;
  }

  if (!sessionUser) {
    return <AuthView />;
  }

  if (profile?.role !== 'admin' && profile?.role !== 'employer') {
    return (
      <div className="center-screen">
        <div className="card auth-card">
          <h1>Admin access required</h1>
          <p className="muted">Your account role is currently `{profile?.role || 'none'}`. Set it to `admin` or `employer` in Supabase.</p>
          <button className="btn btn-primary" onClick={signOut}>Logout</button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <aside className="sidebar">
        <div style={{ marginBottom: '2.5rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--primary)' }}>AI SkillFit</h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600 }}>
            {profile.role === 'admin' ? 'Admin Portal' : 'Employer Portal'}
          </p>
        </div>

        <nav style={{ flex: 1 }}>
          <NavItem icon={<LayoutDashboard size={20} />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavItem icon={<Briefcase size={20} />} label="Job Management" active={activeTab === 'jobs'} onClick={() => setActiveTab('jobs')} />
          <NavItem icon={<Users size={20} />} label="Candidates" active={activeTab === 'candidates'} onClick={() => setActiveTab('candidates')} />
          <NavItem icon={<ShieldCheck size={20} />} label="Face Verify" active={activeTab === 'faceVerify'} onClick={() => setActiveTab('faceVerify')} />
        </nav>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
          <NavItem icon={<LogOut size={20} />} label="Logout" active={false} onClick={signOut} />
        </div>
      </aside>

      <main className="main-content">
        {message ? <div className="notice">{message}</div> : null}
        {activeTab === 'dashboard' && <DashboardView jobs={jobs} candidates={candidates} />}
        {activeTab === 'jobs' && <JobsView jobs={jobs} userId={sessionUser.id} onRefresh={() => fetchData()} setMessage={setMessage} />}
        {activeTab === 'candidates' && <CandidatesView candidates={candidates} onRefresh={() => fetchData()} setMessage={setMessage} />}
        {activeTab === 'faceVerify' && <FaceVerifyView />}
      </main>
    </div>
  );
}

function AuthView() {
  const [isSignup, setIsSignup] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');

    const result = isSignup
      ? await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } })
      : await supabase.auth.signInWithPassword({ email, password });

    if (result.error) setError(result.error.message);
    setLoading(false);
  }

  return (
    <div className="center-screen">
      <form className="card auth-card" onSubmit={submit}>
        <h1>{isSignup ? 'Create admin account' : 'Admin sign in'}</h1>
        <p className="muted">Use the same Supabase account. The profile role must be `admin` or `employer`.</p>
        {error ? <div className="notice error">{error}</div> : null}
        {isSignup && <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" required />}
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" required />
        <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" minLength={8} required />
        <button className="btn btn-primary" disabled={loading}>{loading ? 'Please wait...' : isSignup ? 'Sign up' : 'Sign in'}</button>
        <button className="link-btn" type="button" onClick={() => setIsSignup(!isSignup)}>
          {isSignup ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
        </button>
      </form>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: any) {
  return (
    <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function DashboardView({ jobs, candidates }: any) {
  const trendData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days.map((name, index) => ({
      name,
      apps: candidates.filter((candidate: any) => new Date(candidate.created_at).getDay() === index).length,
    }));
  }, [candidates]);

  const skillData = useMemo(() => {
    const counts = new Map<string, number>();
    jobs.forEach((job: any) => counts.set(job.trade || 'Unknown', (counts.get(job.trade || 'Unknown') || 0) + 1));
    return Array.from(counts.entries()).map(([name, val]) => ({ name, val })).slice(0, 6);
  }, [jobs]);

  return (
    <div>
      <header className="page-header">
        <h2>Welcome back</h2>
        <p>Live overview from your Supabase jobs, applications, and interviews.</p>
      </header>

      <div className="stats-grid">
        <Stat title="Active Jobs" value={jobs.filter((job: any) => job.status === 'open').length} />
        <Stat title="Total Applicants" value={candidates.length} />
        <Stat title="Interviewed" value={candidates.filter((candidate: any) => candidate.interview).length} />
        <Stat title="Shortlisted" value={candidates.filter((candidate: any) => candidate.status === 'shortlisted').length} />
      </div>

      <div className="chart-grid">
        <div className="card">
          <h3>Application Trends</h3>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="apps" stroke="var(--primary)" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <h3>Jobs by Trade</h3>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={skillData}>
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="val" fill="var(--secondary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ title, value }: { title: string; value: number }) {
  return (
    <div className="card stat-card">
      <h3>{title}</h3>
      <div className="value">{value}</div>
    </div>
  );
}

function JobsView({ jobs, userId, onRefresh, setMessage }: any) {
  const [form, setForm] = useState<JobForm>(emptyJobForm);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  function openCreate() {
    setForm(emptyJobForm);
    setShowForm(true);
  }

  function openEdit(job: any) {
    setForm({
      id: job.id,
      title: job.title || '',
      description: job.description || '',
      trade: job.trade || '',
      experience_required: job.experience_required || '',
      location: job.location || '',
      skills_required: (job.skills_required || []).join(', '),
      openings: String(job.openings || 1),
      company_name: job.companies?.company_name || '',
      company_description: job.companies?.description || '',
    });
    setShowForm(true);
  }

  async function saveJob(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      let companyId = jobs.find((job: any) => job.companies?.company_name === form.company_name)?.company_id;

      if (!companyId) {
        const { data: company, error: companyError } = await supabase
          .from('companies')
          .insert({ company_name: form.company_name, description: form.company_description, created_by: userId })
          .select('id')
          .single();
        if (companyError) throw companyError;
        companyId = company.id;
      }

      const payload = {
        company_id: companyId,
        title: form.title,
        description: form.description,
        trade: form.trade,
        experience_required: form.experience_required,
        location: form.location,
        skills_required: form.skills_required.split(',').map((skill) => skill.trim()).filter(Boolean),
        openings: Number(form.openings || 1),
        created_by: userId,
        status: 'open',
      };

      const result = form.id
        ? await supabase.from('jobs').update(payload).eq('id', form.id)
        : await supabase.from('jobs').insert(payload);

      if (result.error) throw result.error;
      setShowForm(false);
      await onRefresh();
    } catch (error: any) {
      setMessage(error.message || 'Failed to save job.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(job: any) {
    const { error } = await supabase
      .from('jobs')
      .update({ status: job.status === 'open' ? 'closed' : 'open' })
      .eq('id', job.id);
    if (error) setMessage(error.message);
    await onRefresh();
  }

  async function deleteJob(jobId: string) {
    if (!confirm('Delete this job and its applications?')) return;
    const { error } = await supabase.from('jobs').delete().eq('id', jobId);
    if (error) setMessage(error.message);
    await onRefresh();
  }

  return (
    <div>
      <div className="page-row">
        <h2>Job Management</h2>
        <button className="btn btn-primary icon-btn" onClick={openCreate}>
          <Plus size={20} /> Post New Job
        </button>
      </div>

      {showForm && (
        <form className="card form-card" onSubmit={saveJob}>
          <h3>{form.id ? 'Edit Job' : 'Post New Job'}</h3>
          <div className="form-grid">
            <input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} placeholder="Company name" required />
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Job title" required />
            <input value={form.trade} onChange={(e) => setForm({ ...form, trade: e.target.value })} placeholder="Trade" required />
            <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Location" required />
            <input value={form.experience_required} onChange={(e) => setForm({ ...form, experience_required: e.target.value })} placeholder="Experience" />
            <input value={form.openings} onChange={(e) => setForm({ ...form, openings: e.target.value })} placeholder="Openings" type="number" min="1" />
          </div>
          <textarea value={form.company_description} onChange={(e) => setForm({ ...form, company_description: e.target.value })} placeholder="Company description" />
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Job description" required />
          <input value={form.skills_required} onChange={(e) => setForm({ ...form, skills_required: e.target.value })} placeholder="Skills, comma separated" />
          <div className="form-actions">
            <button className="btn" type="button" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Job'}</button>
          </div>
        </form>
      )}

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Job Title</th>
              <th>Company</th>
              <th>Trade</th>
              <th>Location</th>
              <th>Applicants</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job: any) => (
              <tr key={job.id}>
                <td style={{ fontWeight: 600 }}>{job.title}</td>
                <td>{job.companies?.company_name || '-'}</td>
                <td>{job.trade}</td>
                <td>{job.location}</td>
                <td>{job.applications?.[0]?.count || 0}</td>
                <td><span className={`badge ${job.status === 'open' ? 'badge-success' : 'badge-danger'}`}>{job.status}</span></td>
                <td className="actions-cell">
                  <button className="link-btn" onClick={() => openEdit(job)}>Edit</button>
                  <button className="link-btn" onClick={() => toggleStatus(job)}>{job.status === 'open' ? 'Close' : 'Open'}</button>
                  <button className="danger-btn" onClick={() => deleteJob(job.id)}><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CandidatesView({ candidates, onRefresh, setMessage }: any) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  const filtered = candidates.filter((candidate: any) => {
    const text = `${candidate.profiles?.full_name || ''} ${candidate.jobs?.title || ''} ${candidate.profiles?.trade || ''}`.toLowerCase();
    return text.includes(query.toLowerCase()) && (filter === 'all' || candidate.status === filter);
  });

  async function updateStatus(candidate: any, status: string) {
    const { error } = await supabase.from('applications').update({ status }).eq('id', candidate.id);
    if (error) setMessage(error.message);
    await onRefresh();
  }

  return (
    <div>
      <header className="page-header">
        <h2>Applicants</h2>
        <div className="search-row">
          <div className="search-box">
            <Search size={18} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search candidates..." />
          </div>
          <Filter size={18} />
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="applied">Applied</option>
            <option value="shortlisted">Shortlisted</option>
            <option value="rejected">Rejected</option>
            <option value="marked_for_training">Marked for training</option>
          </select>
        </div>
      </header>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Job Applied</th>
              <th>Score</th>
              <th>Status</th>
              <th>Classification</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((candidate: any) => (
              <tr key={candidate.id}>
                <td style={{ fontWeight: 600 }}>{candidate.profiles?.full_name || 'Unknown'}</td>
                <td>{candidate.jobs?.title || '-'}</td>
                <td style={{ fontWeight: 800, color: 'var(--primary)' }}>
                  {candidate.interview?.average_score ? `${Math.round(Number(candidate.interview.average_score))}%` : 'N/A'}
                </td>
                <td><span className={`badge ${candidate.status === 'rejected' ? 'badge-danger' : candidate.status === 'shortlisted' ? 'badge-success' : 'badge-warning'}`}>{candidate.status}</span></td>
                <td>{candidate.interview?.classification || '-'}</td>
                <td className="actions-cell">
                  <button className="success-btn" onClick={() => updateStatus(candidate, 'shortlisted')}><CheckCircle size={16} /> Shortlist</button>
                  <button className="danger-inline-btn" onClick={() => updateStatus(candidate, 'rejected')}><XCircle size={16} /> Reject</button>
                  <ChevronRight size={20} style={{ color: 'var(--muted)' }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FaceVerifyView() {
  return (
    <div className="face-verify-view">
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>Face Verification</h2>
          <p>Compare a reference photo with a live camera feed before interviews or candidate checks.</p>
        </div>
        <a className="btn btn-primary" href="/face-verify/" target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
          <ExternalLink size={18} /> Open Full Screen
        </a>
      </header>

      <div className="card" style={{ padding: 0, overflow: 'hidden', height: 'calc(100vh - 250px)', border: '1px solid var(--border)' }}>
        <iframe
          title="Face verification"
          src="/face-verify/"
          style={{ width: '100%', height: '100%', border: 'none' }}
          allow="camera; microphone"
        />
      </div>
    </div>
  );
}
