import React, { useState, useEffect, createContext, useContext, useRef, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc, addDoc, setDoc, updateDoc, onSnapshot, collection, query, where, getDocs, arrayUnion, arrayRemove } from 'firebase/firestore';
import { Home, Briefcase, User, PlusCircle, FileText, Lightbulb, Send, Mail, Phone, MapPin, DollarSign, Calendar, Users, List, Building2, GraduationCap, Code, MessageSquare, Heart, Search, XCircle, CheckCircle, Info, Loader2 } from 'lucide-react';

// Initialize Firebase (global variables provided by Canvas)
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');

// Context for Firebase and User
const AppContext = createContext(null);
const ToastContext = createContext(null);

// Custom Hook for Toast Notifications
const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        // This should theoretically not happen if ToastContainer correctly wraps App
        console.error("useToast must be used within a ToastContainer provider.");
        return () => {}; // Return a no-op function to prevent crashes
    }
    return context;
};

const Toast = ({ message, type, onClose }) => {
    const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';
    const Icon = type === 'success' ? CheckCircle : type === 'error' ? XCircle : Info;

    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, 3000); // Auto-close after 3 seconds
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className={`flex items-center ${bgColor} text-white px-4 py-3 rounded-lg shadow-lg mb-3 animate-fade-in-right`}>
            <Icon className="w-5 h-5 mr-2" />
            <span>{message}</span>
            <button onClick={onClose} className="ml-auto text-white hover:text-gray-100 opacity-75 hover:opacity-100 transition-opacity">
                <XCircle className="w-4 h-4" />
            </button>
        </div>
    );
};

const ToastContainer = ({ children }) => {
    const [toasts, setToasts] = useState([]);
    const toastIdRef = useRef(0);

    const addToast = useCallback((message, type = 'info') => {
        const id = toastIdRef.current++;
        setToasts((prev) => [...prev, { id, message, type }]);
    }, []);

    const removeToast = useCallback((id) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={addToast}>
            {children} {/* Render children here, typically the main App component */}
            <div className="fixed bottom-4 right-4 z-50">
                {toasts.map((toast) => (
                    <Toast key={toast.id} {...toast} onClose={() => removeToast(toast.id)} />
                ))}
            </div>
        </ToastContext.Provider>
    );
};


// Utility function for LLM call (placeholder)
async function getJobRecommendations(prompt) {
    console.log("Simulating AI recommendation for prompt:", prompt);
    // In a real application, you'd send the prompt to a backend
    // that interacts with the Gemini API.
    // For demonstration, we return mock data.
    return [
        { id: 'rec1', title: 'Senior React Developer', company: 'Innovate Tech', location: 'Remote', description: 'Develop scalable web applications using React and Node.js.', requirements: ['5+ years React', 'Node.js', 'AWS'], type: 'Full-time', salary: '120,000 - 150,000 USD' },
        { id: 'rec2', title: 'AI/ML Engineer', company: 'Data Insights Corp', location: 'San Francisco, CA', description: 'Build and deploy machine learning models for data analysis.', requirements: ['Python', 'TensorFlow', 'PyTorch'], type: 'Full-time', salary: '130,000 - 160,000 USD' },
        { id: 'rec3', title: 'UX Designer', company: 'Creative Solutions', location: 'New York, NY', description: 'Design user-friendly interfaces for our new product line.', requirements: ['Figma', 'Sketch', 'User Research'], type: 'Contract', salary: '70 - 90 USD/hour' },
    ];
}

async function getChatbotResponse(chatHistory) {
    const payload = { contents: chatHistory };
    const apiKey = ""; // Canvas will provide this if empty
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (result.candidates && result.candidates.length > 0 &&
            result.candidates[0].content && result.candidates[0].content.parts &&
            result.candidates[0].content.parts.length > 0) {
            return result.candidates[0].content.parts[0].text;
        } else {
            console.error("LLM response structure unexpected:", result);
            return "I'm sorry, I couldn't generate a response.";
        }
    } catch (error) {
        console.error("Error calling LLM for chatbot:", error);
        return "I'm having trouble connecting right now. Please try again later.";
    }
}


// Sample Jobs Data
const sampleJobs = [
    {
        title: 'Software Engineer',
        company: 'Tech Innovators Inc.',
        location: 'San Francisco, CA',
        description: 'We are looking for a passionate Software Engineer to design, develop and install software solutions. You will be responsible for writing clean, scalable code, and collaborating with cross-functional teams.',
        requirements: ['Proficiency in JavaScript, Python, or Java', 'Experience with React or Angular', 'Strong problem-solving skills'],
        salary: '100,000 - 130,000 USD',
        type: 'Full-time',
        contactEmail: 'hr@techinnovators.com',
        contactPhone: '555-123-4567',
        recruiterId: 'sample-recruiter-1', // Placeholder, will be updated if recruiter logs in
        postedDate: new Date().toISOString(),
        applicants: [],
    },
    {
        title: 'Marketing Specialist',
        company: 'Global Marketing Solutions',
        location: 'New York, NY',
        description: 'Develop and implement marketing strategies, manage social media campaigns, and analyze market trends. Ideal candidate has experience with digital marketing tools and a creative mindset.',
        requirements: ['Bachelor\'s degree in Marketing', '2+ years digital marketing experience', 'SEO/SEM knowledge'],
        salary: '60,000 - 80,000 USD',
        type: 'Full-time',
        contactEmail: 'careers@globalmarketing.com',
        contactPhone: '555-987-6543',
        recruiterId: 'sample-recruiter-2',
        postedDate: new Date().toISOString(),
        applicants: [],
    },
    {
        title: 'Data Scientist',
        company: 'Data Insights Corp',
        location: 'Seattle, WA',
        description: 'Analyze complex datasets, build predictive models, and provide actionable insights. Strong statistical and programming skills required.',
        requirements: ['Master\'s or PhD in a quantitative field', 'Proficiency in Python/R', 'Experience with machine learning frameworks'],
        salary: '110,000 - 140,000 USD',
        type: 'Full-time',
        contactEmail: 'jobs@datainsights.com',
        contactPhone: '555-222-3333',
        recruiterId: 'sample-recruiter-1',
        postedDate: new Date().toISOString(),
        applicants: [],
    },
    {
        title: 'UX/UI Designer',
        company: 'Creative Studio',
        location: 'Remote',
        description: 'Design intuitive and aesthetically pleasing user interfaces for web and mobile applications. Collaborate with product and engineering teams.',
        requirements: ['Portfolio showcasing design projects', 'Proficiency in Figma, Sketch, or Adobe XD', 'Understanding of user-centered design principles'],
        salary: '90,000 - 110,000 USD',
        type: 'Contract',
        contactEmail: 'design@creativestudio.com',
        contactPhone: '555-444-5555',
        recruiterId: 'sample-recruiter-2',
        postedDate: new Date().toISOString(),
        applicants: [],
    },
    {
        title: 'Customer Support Representative',
        company: 'Service Solutions LLC',
        location: 'Dallas, TX',
        description: 'Provide excellent customer service and support to our clients via phone, email, and chat. Resolve inquiries and ensure customer satisfaction.',
        requirements: ['Strong communication skills', 'Problem-solving abilities', 'Previous customer service experience preferred'],
        salary: '40,000 - 50,000 USD',
        type: 'Full-time',
        contactEmail: 'support@servicesolutions.com',
        contactPhone: '555-666-7777',
        recruiterId: 'sample-recruiter-1',
        postedDate: new Date().toISOString(),
        applicants: [],
    },
];


// Components
const Navbar = ({ setCurrentPage, user, userId }) => {
    return (
        <nav className="bg-gradient-to-r from-blue-700 to-indigo-800 p-4 shadow-xl rounded-b-2xl">
            <div className="container mx-auto flex justify-between items-center flex-wrap">
                <div className="text-white text-4xl font-extrabold font-inter cursor-pointer tracking-wide" onClick={() => setCurrentPage('home')}>
                    JobConnect
                </div>
                <div className="flex space-x-4 mt-2 sm:mt-0">
                    <NavItem icon={<Home className="w-5 h-5" />} text="Home" onClick={() => setCurrentPage('home')} />
                    <NavItem icon={<Briefcase className="w-5 h-5" />} text="Jobs" onClick={() => setCurrentPage('jobListings')} />
                    {user?.type === 'recruiter' && (
                        <NavItem icon={<PlusCircle className="w-5 h-5" />} text="Post Job" onClick={() => setCurrentPage('postJob')} />
                    )}
                    <NavItem icon={<User className="w-5 h-5" />} text="Profile" onClick={() => setCurrentPage('profile')} />
                    <NavItem icon={<Lightbulb className="w-5 h-5" />} text="AI Recom." onClick={() => setCurrentPage('aiRecommendations')} />
                    <NavItem icon={<MessageSquare className="w-5 h-5" />} text="AI Chat" onClick={() => setCurrentPage('chatbot')} />
                </div>
            </div>
            {userId && (
                <div className="text-blue-200 text-xs mt-2 text-center">
                    User ID: <span className="font-mono">{userId}</span>
                </div>
            )}
        </nav>
    );
};

const NavItem = ({ icon, text, onClick }) => (
    <button
        className="flex items-center space-x-2 text-white text-lg font-semibold hover:text-blue-200 transition-all duration-300 p-2 rounded-lg hover:bg-white hover:bg-opacity-10 transform hover:scale-105"
        onClick={onClick}
    >
        {icon}
        <span>{text}</span>
    </button>
);

const JobCard = ({ job, onViewDetails, onApply, onSaveJob, isSaved }) => {
    const handleSaveClick = (e) => {
        e.stopPropagation(); // Prevent triggering view details
        onSaveJob(job.id);
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-200 flex flex-col justify-between">
            <div>
                <div className="flex justify-between items-start mb-2">
                    <h3 className="text-2xl font-bold text-gray-800">{job.title}</h3>
                    <button
                        onClick={handleSaveClick}
                        className={`p-2 rounded-full transition-colors duration-200 ${isSaved ? 'text-red-500 bg-red-100' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'}`}
                        title={isSaved ? "Unsave Job" : "Save Job"}
                    >
                        <Heart className="w-6 h-6 fill-current" />
                    </button>
                </div>
                <p className="text-blue-600 font-semibold mb-2 flex items-center"><Building2 className="w-4 h-4 mr-2" />{job.company}</p>
                <p className="text-gray-600 mb-2 flex items-center"><MapPin className="w-4 h-4 mr-2" />{job.location}</p>
                <p className="text-gray-700 mb-4 line-clamp-3">{job.description}</p>
            </div>
            <div className="flex justify-between items-center mt-4">
                <button
                    onClick={() => onViewDetails(job)}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-5 py-2 rounded-lg shadow-md transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
                >
                    View Details
                </button>
                <button
                    onClick={() => onApply(job)}
                    className="bg-green-500 hover:bg-green-600 text-white px-5 py-2 rounded-lg shadow-md transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
                >
                    Apply Now
                </button>
            </div>
        </div>
    );
};

const JobListingPage = ({ jobs, setCurrentPage, setSelectedJob, user, onSaveJob }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterLocation, setFilterLocation] = useState('');
    const [filterType, setFilterType] = useState('');

    const addToast = useToast();

    const handleViewDetails = (job) => {
        setSelectedJob(job);
        setCurrentPage('jobDetail');
    };

    const handleApply = (job) => {
        if (!user || user.type !== 'jobSeeker') {
            addToast('Please login as a Job Seeker to apply for jobs.', 'error');
            return;
        }
        setSelectedJob(job);
        setCurrentPage('jobDetail'); // Go to detail page to apply
    };

    const filteredJobs = jobs.filter(job => {
        const matchesSearch = job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              job.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              job.description.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesLocation = filterLocation === '' || job.location.toLowerCase().includes(filterLocation.toLowerCase());
        const matchesType = filterType === '' || job.type === filterType;
        return matchesSearch && matchesLocation && matchesType;
    });

    const uniqueLocations = [...new Set(jobs.map(job => job.location))];
    const uniqueTypes = [...new Set(jobs.map(job => job.type))];

    const savedJobIds = user?.savedJobs?.map(job => job.jobId) || [];

    return (
        <div className="container mx-auto p-6">
            <h2 className="text-4xl font-extrabold text-gray-900 mb-8 text-center">Available Job Openings</h2>

            <div className="bg-white p-6 rounded-xl shadow-md mb-8 flex flex-wrap gap-4 justify-center items-center">
                <div className="flex-grow max-w-md">
                    <label htmlFor="search" className="sr-only">Search Jobs</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            id="search"
                            placeholder="Search by title, company, or keyword..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>

                <div className="w-full sm:w-auto flex-grow sm:flex-grow-0">
                    <label htmlFor="filterLocation" className="sr-only">Filter by Location</label>
                    <select
                        id="filterLocation"
                        value={filterLocation}
                        onChange={(e) => setFilterLocation(e.target.value)}
                        className="w-full py-2 px-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">All Locations</option>
                        {uniqueLocations.map(loc => (
                            <option key={loc} value={loc}>{loc}</option>
                        ))}
                    </select>
                </div>

                <div className="w-full sm:w-auto flex-grow sm:flex-grow-0">
                    <label htmlFor="filterType" className="sr-only">Filter by Type</label>
                    <select
                        id="filterType"
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="w-full py-2 px-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">All Types</option>
                        {uniqueTypes.map(type => (
                            <option key={type} value={type}>{type}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredJobs.length === 0 ? (
                    <p className="col-span-full text-center text-gray-600 text-lg py-10">No jobs found matching your criteria. Try adjusting your filters.</p>
                ) : (
                    filteredJobs.map((job) => (
                        <JobCard
                            key={job.id}
                            job={job}
                            onViewDetails={handleViewDetails}
                            onApply={handleApply}
                            onSaveJob={onSaveJob}
                            isSaved={savedJobIds.includes(job.id)}
                        />
                    ))
                )}
            </div>
        </div>
    );
};

const JobDetailPage = ({ job, setCurrentPage, applyForJob, user, onSaveJob, isJobSaved }) => {
    const addToast = useToast();

    const handleApply = async () => {
        if (!user || user.type !== 'jobSeeker') {
            addToast('Please login as a Job Seeker to apply for jobs.', 'error');
            return;
        }
        if (!user.profileComplete) {
            addToast('Please complete your profile before applying for jobs.', 'error');
            return;
        }
        await applyForJob(job.id);
    };

    if (!job) {
        return (
            <div className="container mx-auto p-6 text-center">
                <p className="text-gray-600 text-lg">Job not found.</p>
                <button
                    onClick={() => setCurrentPage('jobListings')}
                    className="mt-6 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg shadow-md transition-colors duration-200 flex items-center mx-auto"
                >
                    <span className="mr-2">&larr;</span> Back to Jobs
                </button>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6">
            <button
                onClick={() => setCurrentPage('jobListings')}
                className="mb-6 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg shadow-md transition-colors duration-200 flex items-center"
            >
                <span className="mr-2">&larr;</span> Back to Jobs
            </button>
            <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-200">
                <div className="flex justify-between items-start mb-4">
                    <h2 className="text-4xl font-extrabold text-gray-900">{job.title}</h2>
                    {user?.type === 'jobSeeker' && (
                        <button
                            onClick={() => onSaveJob(job.id)}
                            className={`p-3 rounded-full transition-colors duration-200 ${isJobSaved(job.id) ? 'text-red-500 bg-red-100' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'}`}
                            title={isJobSaved(job.id) ? "Unsave Job" : "Save Job"}
                        >
                            <Heart className="w-7 h-7 fill-current" />
                        </button>
                    )}
                </div>
                <p className="text-blue-600 text-xl font-semibold mb-3 flex items-center"><Building2 className="w-5 h-5 mr-2" />{job.company}</p>
                <p className="text-gray-700 text-lg mb-3 flex items-center"><MapPin className="w-5 h-5 mr-2" />{job.location}</p>
                <p className="text-gray-700 text-lg mb-3 flex items-center"><DollarSign className="w-5 h-5 mr-2" />{job.salary || 'Competitive'}</p>
                <p className="text-gray-700 text-lg mb-6 flex items-center"><Calendar className="w-5 h-5 mr-2" />{job.type}</p>

                <h3 className="text-2xl font-bold text-gray-800 mb-3">Job Description</h3>
                <p className="text-gray-700 leading-relaxed mb-6">{job.description}</p>

                <h3 className="text-2xl font-bold text-gray-800 mb-3">Requirements</h3>
                <ul className="list-disc list-inside text-gray-700 mb-6">
                    {job.requirements && job.requirements.map((req, index) => (
                        <li key={index} className="mb-1 flex items-center"><Code className="w-4 h-4 mr-2 text-blue-500" />{req}</li>
                    ))}
                </ul>

                <h3 className="text-2xl font-bold text-gray-800 mb-3">Contact Information</h3>
                <p className="text-gray-700 mb-2 flex items-center"><Mail className="w-5 h-5 mr-2" />{job.contactEmail}</p>
                <p className="text-gray-700 mb-6 flex items-center"><Phone className="w-5 h-5 mr-2" />{job.contactPhone}</p>

                <button
                    onClick={handleApply}
                    className="w-full bg-green-600 hover:bg-green-700 text-white text-xl font-bold py-3 rounded-lg shadow-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
                >
                    Apply for this Job
                </button>
            </div>
        </div>
    );
};

const PostJobPage = ({ userId, addJob }) => {
    const [jobData, setJobData] = useState({
        title: '',
        company: '',
        location: '',
        description: '',
        requirements: '', // Comma separated
        salary: '',
        type: 'Full-time',
        contactEmail: '',
        contactPhone: '',
    });
    const addToast = useToast();

    const handleChange = (e) => {
        const { name, value } = e.target;
        setJobData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!userId) {
            addToast('You must be logged in to post a job.', 'error');
            return;
        }

        const jobToSave = {
            ...jobData,
            recruiterId: userId,
            requirements: jobData.requirements.split(',').map(req => req.trim()).filter(req => req !== ''),
            postedDate: new Date().toISOString(),
            applicants: [], // Initialize with an empty array of applicant UIDs
        };

        await addJob(jobToSave);
        addToast('Job posted successfully!', 'success');
        setJobData({
            title: '', company: '', location: '', description: '',
            requirements: '', salary: '', type: 'Full-time', contactEmail: '', contactPhone: ''
        });
    };

    return (
        <div className="container mx-auto p-6">
            <h2 className="text-4xl font-extrabold text-gray-900 mb-8 text-center">Post a New Job</h2>
            <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl shadow-lg border border-gray-200 max-w-2xl mx-auto">
                <InputField label="Job Title" name="title" value={jobData.title} onChange={handleChange} required />
                <InputField label="Company" name="company" value={jobData.company} onChange={handleChange} required />
                <InputField label="Location" name="location" value={jobData.location} onChange={handleChange} required />
                <TextAreaField label="Job Description" name="description" value={jobData.description} onChange={handleChange} required />
                <InputField label="Requirements (comma-separated)" name="requirements" value={jobData.requirements} onChange={handleChange} placeholder="e.g., React, Node.js, AWS" />
                <InputField label="Salary (e.g., 80,000 - 100,000 USD)" name="salary" value={jobData.salary} onChange={handleChange} />

                <div className="mb-6">
                    <label htmlFor="type" className="block text-gray-700 text-sm font-bold mb-2">Job Type</label>
                    <select
                        id="type"
                        name="type"
                        value={jobData.type}
                        onChange={handleChange}
                        className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        <option value="Full-time">Full-time</option>
                        <option value="Part-time">Part-time</option>
                        <option value="Contract">Contract</option>
                        <option value="Internship">Internship</option>
                    </select>
                </div>

                <InputField label="Contact Email" name="contactEmail" type="email" value={jobData.contactEmail} onChange={handleChange} required />
                <InputField label="Contact Phone" name="contactPhone" type="tel" value={jobData.contactPhone} onChange={handleChange} />

                <button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xl font-bold py-3 rounded-lg shadow-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 mt-6"
                >
                    Post Job
                </button>
            </form>
        </div>
    );
};

const ProfilePage = ({ user, userId, updateUserProfile, appliedJobs, postedJobs, allUsers, savedJobs, onSaveJob }) => {
    const [profileData, setProfileData] = useState({
        name: '',
        email: '',
        phone: '',
        type: 'jobSeeker', // 'jobSeeker' or 'recruiter'
        resumeUrl: '', // Placeholder for resume upload
        skills: '', // Comma separated
        experience: '',
        education: '',
    });
    const addToast = useToast();
    const [activeTab, setActiveTab] = useState('profile'); // 'profile', 'applications', 'postedJobs', 'savedJobs'

    useEffect(() => {
        if (user) {
            setProfileData({
                name: user.name || '',
                email: user.email || '',
                phone: user.phone || '',
                type: user.type || 'jobSeeker',
                resumeUrl: user.resumeUrl || '',
                skills: (user.skills || []).join(', '),
                experience: user.experience || '',
                education: user.education || '',
            });
        }
    }, [user]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setProfileData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!userId) {
            addToast('User not authenticated.', 'error');
            return;
        }

        const profileToSave = {
            ...profileData,
            skills: profileData.skills.split(',').map(s => s.trim()).filter(s => s !== ''),
            profileComplete: true, // Mark profile as complete
        };

        await updateUserProfile(userId, profileToSave);
        addToast('Profile updated successfully!', 'success');
    };

    const getApplicantName = (applicantId) => {
        const applicant = allUsers.find(u => u.id === applicantId);
        return applicant ? applicant.name || 'Anonymous User' : 'Unknown User';
    };

    return (
        <div className="container mx-auto p-6">
            <h2 className="text-4xl font-extrabold text-gray-900 mb-8 text-center">Your Profile</h2>

            <div className="flex justify-center mb-8 flex-wrap gap-2">
                <TabButton isActive={activeTab === 'profile'} onClick={() => setActiveTab('profile')}>
                    <User className="w-5 h-5 mr-2" /> Profile Details
                </TabButton>
                {user?.type === 'jobSeeker' && (
                    <>
                        <TabButton isActive={activeTab === 'applications'} onClick={() => setActiveTab('applications')}>
                            <Send className="w-5 h-5 mr-2" /> My Applications
                        </TabButton>
                        <TabButton isActive={activeTab === 'savedJobs'} onClick={() => setActiveTab('savedJobs')}>
                            <Heart className="w-5 h-5 mr-2" /> Saved Jobs
                        </TabButton>
                    </>
                )}
                {user?.type === 'recruiter' && (
                    <TabButton isActive={activeTab === 'postedJobs'} onClick={() => setActiveTab('postedJobs')}>
                        <List className="w-5 h-5 mr-2" /> My Posted Jobs
                    </TabButton>
                )}
            </div>

            {activeTab === 'profile' && (
                <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl shadow-lg border border-gray-200 max-w-2xl mx-auto">
                    <div className="mb-6">
                        <label htmlFor="type" className="block text-gray-700 text-sm font-bold mb-2">Account Type</label>
                        <select
                            id="type"
                            name="type"
                            value={profileData.type}
                            onChange={handleChange}
                            className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="jobSeeker">Job Seeker</option>
                            <option value="recruiter">Recruiter</option>
                        </select>
                    </div>

                    <InputField label="Full Name" name="name" value={profileData.name} onChange={handleChange} required />
                    <InputField label="Email" name="email" type="email" value={profileData.email} onChange={handleChange} required />
                    <InputField label="Phone" name="phone" type="tel" value={profileData.phone} onChange={handleChange} />

                    {profileData.type === 'jobSeeker' && (
                        <>
                            <InputField label="Resume URL (e.g., Google Drive link)" name="resumeUrl" value={profileData.resumeUrl} onChange={handleChange} />
                            <InputField label="Skills (comma-separated)" name="skills" value={profileData.skills} onChange={handleChange} placeholder="e.g., React, Python, SQL" />
                            <TextAreaField label="Experience" name="experience" value={profileData.experience} onChange={handleChange} />
                            <TextAreaField label="Education" name="education" value={profileData.education} onChange={handleChange} />
                        </>
                    )}

                    <button
                        type="submit"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xl font-bold py-3 rounded-lg shadow-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 mt-6"
                    >
                        Save Profile
                    </button>
                </form>
            )}

            {activeTab === 'applications' && user?.type === 'jobSeeker' && (
                <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-200 max-w-4xl mx-auto">
                    <h3 className="text-3xl font-bold text-gray-800 mb-6">My Job Applications</h3>
                    {appliedJobs.length === 0 ? (
                        <div className="text-center py-10">
                            <Send className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                            <p className="text-gray-600 text-lg">You haven't applied for any jobs yet.</p>
                            <button
                                onClick={() => setActiveTab('profile')} // Navigate to profile to complete it
                                className="mt-4 bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg shadow-md transition-colors duration-200"
                            >
                                Find Jobs
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            {appliedJobs.map(job => (
                                <div key={job.id} className="bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-200">
                                    <h4 className="text-xl font-semibold text-gray-800">{job.title}</h4>
                                    <p className="text-blue-600 text-md">{job.company}</p>
                                    <p className="text-gray-600 text-sm">{job.location}</p>                                    <p className="text-gray-500 text-sm mt-2">Applied on: {new Date(job.appliedDate).toLocaleDateString()}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'savedJobs' && user?.type === 'jobSeeker' && (
                <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-200 max-w-4xl mx-auto">
                    <h3 className="text-3xl font-bold text-gray-800 mb-6">My Saved Jobs</h3>
                    {savedJobs.length === 0 ? (
                        <div className="text-center py-10">
                            <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                            <p className="text-gray-600 text-lg">You haven't saved any jobs yet.</p>
                            <button
                                onClick={() => setActiveTab('profile')} // Navigate to profile to complete it
                                className="mt-4 bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg shadow-md transition-colors duration-200"
                            >
                                Browse Jobs
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            {savedJobs.map(job => (
                                <div key={job.id} className="bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-200 flex justify-between items-center">
                                    <div>
                                        <h4 className="text-xl font-semibold text-gray-800">{job.title}</h4>
                                        <p className="text-blue-600 text-md">{job.company}</p>
                                        <p className="text-gray-600 text-sm">{job.location}</p>
                                    </div>
                                    <button
                                        onClick={() => onSaveJob(job.id)} // To unsave
                                        className="p-2 rounded-full text-red-500 bg-red-100 hover:bg-red-200 transition-colors duration-200"
                                        title="Unsave Job"
                                    >
                                        <XCircle className="w-6 h-6" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'postedJobs' && user?.type === 'recruiter' && (
                <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-200 max-w-4xl mx-auto">
                    <h3 className="text-3xl font-bold text-gray-800 mb-6">My Posted Jobs</h3>
                    {postedJobs.length === 0 ? (
                        <div className="text-center py-10">
                            <List className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                            <p className="text-gray-600 text-lg">You haven't posted any jobs yet.</p>
                            <button
                                onClick={() => setActiveTab('profile')} // Navigate to profile to complete it
                                className="mt-4 bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg shadow-md transition-colors duration-200"
                            >
                                Post a Job
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            {postedJobs.map(job => (
                                <div key={job.id} className="bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-200">
                                    <h4 className="text-xl font-semibold text-gray-800">{job.title}</h4>
                                    <p className="text-blue-600 text-md">{job.company}</p>
                                    <p className="text-gray-600 text-sm mb-2">Location: {job.location}</p>
                                    <p className="text-gray-700 text-md mb-2 flex items-center"><Users className="w-4 h-4 mr-2" /> Applicants: {job.applicants?.length || 0}</p>
                                    {job.applicants && job.applicants.length > 0 && (
                                        <div className="mt-2 p-3 bg-white rounded-lg border border-gray-100">
                                            <h5 className="text-md font-semibold text-gray-700 mb-2">Applicants:</h5>
                                            <ul className="list-disc list-inside text-gray-600 text-sm">
                                                {job.applicants.map((applicantId, index) => (
                                                    <li key={index} className="mb-1">
                                                        {getApplicantName(applicantId)} (ID: {applicantId})
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const AIRecommendationsPage = ({ user, jobs }) => {
    const [recommendations, setRecommendations] = useState([]);
    const [loading, setLoading] = useState(false);
    const addToast = useToast();

    const generateRecommendations = async () => {
        if (!user || !user.profileComplete) {
            addToast('Please complete your profile to get personalized recommendations.', 'error');
            return;
        }

        setLoading(true);
        try {
            const userSkills = (user.skills && user.skills.length > 0) ? user.skills.join(', ') : 'no specific skills listed';
            const userExperience = user.experience || 'no experience listed';
            const userEducation = user.education || 'no education listed';

            const prompt = `Given the user's profile:
            Skills: ${userSkills}
            Experience: ${userExperience}
            Education: ${userEducation}
            
            And the available jobs: ${JSON.stringify(jobs.map(j => ({ id: j.id, title: j.title, description: j.description, requirements: j.requirements })))}

            Suggest 3-5 relevant job recommendations from the available jobs. Provide the recommendations as a JSON array of objects, each with 'id', 'title', 'company', 'location', 'description', 'requirements', 'type', 'salary' fields. Only recommend jobs that are actually in the 'jobs' list provided. Ensure the 'id' field matches an existing job ID from the provided list.`;

            const recommendedJobs = await getJobRecommendations(prompt);
            setRecommendations(recommendedJobs);
            if (recommendedJobs.length === 0) {
                addToast('No recommendations found based on your profile.', 'info');
            } else {
                addToast('Recommendations generated successfully!', 'success');
            }
        } catch (error) {
            console.error("Failed to fetch recommendations:", error);
            addToast('Failed to generate recommendations. Please try again later.', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mx-auto p-6">
            <h2 className="text-4xl font-extrabold text-gray-900 mb-8 text-center">AI Job Recommendations</h2>
            <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-200 max-w-3xl mx-auto text-center">
                <p className="text-gray-700 text-lg mb-6">
                    Get personalized job recommendations based on your profile and available opportunities.
                    Please ensure your profile is complete for the best results.
                </p>
                <button
                    onClick={generateRecommendations}
                    disabled={loading}
                    className="bg-purple-600 hover:bg-purple-700 text-white text-xl font-bold py-3 px-8 rounded-lg shadow-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? (
                        <span className="flex items-center justify-center">
                            <Loader2 className="animate-spin mr-2 w-6 h-6" /> Generating...
                        </span>
                    ) : 'Get Recommendations'}
                </button>

                {loading && (
                    <div className="flex justify-center items-center mt-6">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                        <p className="ml-3 text-gray-600">Thinking...</p>
                    </div>
                )}

                {recommendations.length > 0 && (
                    <div className="mt-10 text-left">
                        <h3 className="text-3xl font-bold text-gray-800 mb-6">Recommended Jobs for You:</h3>
                        <div className="grid grid-cols-1 gap-4">
                            {recommendations.map((rec) => {
                                // Find the full job object from the 'jobs' list to ensure all details are present
                                const fullJob = jobs.find(j => j.id === rec.id) || rec;
                                return (
                                    <div key={fullJob.id} className="bg-blue-50 p-4 rounded-lg shadow-sm border border-blue-200">
                                        <h4 className="text-xl font-semibold text-gray-800">{fullJob.title}</h4>
                                        <p className="text-blue-600 text-md">{fullJob.company} - {fullJob.location}</p>
                                        <p className="text-gray-700 text-sm mt-2 line-clamp-2">{fullJob.description}</p>
                                        <p className="text-gray-600 text-sm mt-1">Skills: {fullJob.requirements?.join(', ') || 'N/A'}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const ChatbotPage = () => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async () => {
        if (input.trim() === '') return;

        const newUserMessage = { role: 'user', parts: [{ text: input }] };
        const newChatHistory = [...messages, newUserMessage];
        setMessages(newChatHistory);
        setInput('');
        setIsLoading(true);

        try {
            const aiResponseText = await getChatbotResponse(newChatHistory);
            setMessages(prev => [...prev, { role: 'model', parts: [{ text: aiResponseText }] }]);
        } catch (error) {
            console.error("Error getting chatbot response:", error);
            setMessages(prev => [...prev, { role: 'model', parts: [{ text: "Oops! Something went wrong. Please try again." }] }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !isLoading) {
            handleSend();
        }
    };

    return (
        <div className="container mx-auto p-6 flex flex-col h-[calc(100vh-160px)]"> {/* Adjust height based on navbar/footer */}
            <h2 className="text-4xl font-extrabold text-gray-900 mb-8 text-center">AI Job Assistant Chatbot</h2>
            <div className="flex-grow bg-white rounded-xl shadow-lg border border-gray-200 p-6 flex flex-col overflow-hidden">
                <div className="flex-grow overflow-y-auto pr-4 custom-scrollbar">
                    {messages.length === 0 && (
                        <div className="text-center text-gray-500 text-lg mt-10">
                            Hi there! I'm your AI Job Assistant. How can I help you today?
                            <br/>
                            Try asking me about job search tips, resume advice, or interview preparation!
                        </div>
                    )}
                    {messages.map((msg, index) => (
                        <div
                            key={index}
                            className={`flex mb-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[70%] p-3 rounded-lg shadow-md ${
                                    msg.role === 'user'
                                        ? 'bg-blue-500 text-white rounded-br-none'
                                        : 'bg-gray-200 text-gray-800 rounded-bl-none'
                                }`}
                            >
                                {msg.parts[0].text}
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start mb-4">
                            <div className="max-w-[70%] p-3 rounded-lg shadow-md bg-gray-200 text-gray-800 rounded-bl-none">
                                <div className="animate-pulse flex space-x-2">
                                    <div className="h-2 w-2 bg-gray-400 rounded-full"></div>
                                    <div className="h-2 w-2 bg-gray-400 rounded-full"></div>
                                    <div className="h-2 w-2 bg-gray-400 rounded-full"></div>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
                <div className="mt-4 flex items-center">
                    <input
                        type="text"
                        className="flex-grow shadow appearance-none border rounded-lg py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mr-3"
                        placeholder="Type your message..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        disabled={isLoading}
                    />
                    <button
                        onClick={handleSend}
                        disabled={isLoading || input.trim() === ''}
                        className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg shadow-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Send className="w-6 h-6" />
                    </button>
                </div>
            </div>
        </div>
    );
};


// Reusable UI Components
const InputField = ({ label, name, type = 'text', value, onChange, required = false, placeholder = '' }) => (
    <div className="mb-6">
        <label htmlFor={name} className="block text-gray-700 text-sm font-bold mb-2">
            {label} {required && <span className="text-red-500">*</span>}
        </label>
        <input
            type={type}
            id={name}
            name={name}
            value={value}
            onChange={onChange}
            required={required}
            placeholder={placeholder}
            className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
    </div>
);

const TextAreaField = ({ label, name, value, onChange, required = false, placeholder = '' }) => (
    <div className="mb-6">
        <label htmlFor={name} className="block text-gray-700 text-sm font-bold mb-2">
            {label} {required && <span className="text-red-500">*</span>}
        </label>
        <textarea
            id={name}
            name={name}
            value={value}
            onChange={onChange}
            required={required}
            placeholder={placeholder}
            rows="5"
            className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        ></textarea>
    </div>
);

const TabButton = ({ children, isActive, onClick }) => (
    <button
        className={`flex items-center px-6 py-3 rounded-t-lg font-semibold text-lg transition-colors duration-200
            ${isActive ? 'bg-white text-blue-700 shadow-md border-b-4 border-blue-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        onClick={onClick}
    >
        {children}
    </button>
);


// Main App Component
const AppContent = () => { // Renamed to AppContent as App will be the wrapper
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [user, setUser] = useState(null); // Stores user profile data from Firestore
    const [jobs, setJobs] = useState([]);
    const [appliedJobs, setAppliedJobs] = useState([]); // Jobs user has applied to
    const [postedJobs, setPostedJobs] = useState([]); // Jobs posted by the current recruiter
    const [savedJobs, setSavedJobs] = useState([]); // Jobs saved by the current job seeker
    const [allUsers, setAllUsers] = useState([]); // For recruiter to see applicant names
    const [currentPage, setCurrentPage] = useState('home');
    const [selectedJob, setSelectedJob] = useState(null);

    const addToast = useToast(); // Get the addToast function from context

    // Firebase Initialization and Auth Listener
    useEffect(() => {
        try {
            const app = initializeApp(firebaseConfig);
            const firestore = getFirestore(app);
            const firebaseAuth = getAuth(app);

            setDb(firestore);
            setAuth(firebaseAuth);

            // Sign in with custom token or anonymously
            const signIn = async () => {
                try {
                    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                        await signInWithCustomToken(firebaseAuth, __initial_auth_token);
                    } else {
                        await signInAnonymously(firebaseAuth);
                    }
                } catch (error) {
                    console.error("Firebase sign-in error:", error);
                    addToast("Failed to sign in. Please try refreshing.", 'error');
                    // Fallback to anonymous if custom token fails or is not provided
                    await signInAnonymously(firebaseAuth);
                }
            };
            signIn();

            // Auth state change listener
            const unsubscribeAuth = onAuthStateChanged(firebaseAuth, (currentUser) => {
                if (currentUser) {
                    setUserId(currentUser.uid);
                } else {
                    setUserId(null);
                    setUser(null);
                }
            });

            return () => unsubscribeAuth();
        } catch (error) {
            console.error("Failed to initialize Firebase:", error);
            addToast("Failed to initialize Firebase. Check console for details.", 'error');
        }
    }, [addToast]);

    // Populate sample jobs if the collection is empty
    useEffect(() => {
        const addSampleJobs = async () => {
            if (db) {
                const jobsCollectionRef = collection(db, `artifacts/${appId}/public/data/jobs`);
                const snapshot = await getDocs(jobsCollectionRef);
                if (snapshot.empty) {
                    console.log("Adding sample jobs to Firestore...");
                    for (const job of sampleJobs) {
                        try {
                            await addDoc(jobsCollectionRef, job);
                        } catch (e) {
                            console.error("Error adding sample job:", e);
                            addToast("Failed to add sample jobs.", 'error');
                        }
                    }
                    console.log("Sample jobs added.");
                }
            }
        };
        addSampleJobs();
    }, [db, appId, addToast]);


    // Fetch user profile when userId changes
    useEffect(() => {
        if (db && userId) {
            const userDocRef = doc(db, `artifacts/${appId}/users/${userId}/profile`, 'data');
            const unsubscribeProfile = onSnapshot(userDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    setUser({ id: docSnap.id, ...docSnap.data() });
                } else {
                    // Create a basic profile if it doesn't exist
                    const initialProfile = { name: 'New User', email: '', phone: '', type: 'jobSeeker', profileComplete: false, appliedJobs: [], savedJobs: [] };
                    setDoc(userDocRef, initialProfile).then(() => {
                        setUser({ id: docSnap.id, ...initialProfile });
                    }).catch(e => console.error("Error creating initial profile:", e));
                }
            }, (error) => {
                console.error("Error listening to user profile:", error);
                addToast("Failed to load user profile.", 'error');
            });

            return () => unsubscribeProfile();
        }
    }, [db, userId, appId, addToast]);

    // Fetch all jobs
    useEffect(() => {
        if (db) {
            const jobsCollectionRef = collection(db, `artifacts/${appId}/public/data/jobs`);
            const unsubscribeJobs = onSnapshot(jobsCollectionRef, (snapshot) => {
                const jobsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setJobs(jobsData);
            }, (error) => {
                console.error("Error listening to jobs:", error);
                addToast("Failed to load job listings.", 'error');
            });

            return () => unsubscribeJobs();
        }
    }, [db, appId, addToast]);

    // Fetch applied jobs and saved jobs for job seeker or posted jobs for recruiter
    useEffect(() => {
        if (db && userId && user) {
            if (user.type === 'jobSeeker') {
                const fetchJobSeekerData = async () => {
                    // Fetch applied jobs
                    const appliedJobIds = user.appliedJobs || [];
                    const fetchedAppliedJobs = [];
                    for (const jobIdEntry of appliedJobIds) {
                        const jobDocRef = doc(db, `artifacts/${appId}/public/data/jobs`, jobIdEntry.jobId);
                        const jobSnap = await getDoc(jobDocRef);
                        if (jobSnap.exists()) {
                            fetchedAppliedJobs.push({ ...jobSnap.data(), id: jobSnap.id, appliedDate: jobIdEntry.appliedDate });
                        }
                    }
                    setAppliedJobs(fetchedAppliedJobs);

                    // Fetch saved jobs
                    const savedJobIds = user.savedJobs || [];
                    const fetchedSavedJobs = [];
                    for (const jobIdEntry of savedJobIds) {
                        const jobDocRef = doc(db, `artifacts/${appId}/public/data/jobs`, jobIdEntry.jobId);
                        const jobSnap = await getDoc(jobDocRef);
                        if (jobSnap.exists()) {
                            fetchedSavedJobs.push({ ...jobSnap.data(), id: jobSnap.id, savedDate: jobIdEntry.savedDate });
                        }
                    }
                    setSavedJobs(fetchedSavedJobs);
                };
                fetchJobSeekerData();
            } else if (user.type === 'recruiter') {
                const postedJobsQuery = query(collection(db, `artifacts/${appId}/public/data/jobs`), where("recruiterId", "==", userId));
                const unsubscribePostedJobs = onSnapshot(postedJobsQuery, (snapshot) => {
                    const postedJobsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    setPostedJobs(postedJobsData);
                }, (error) => {
                    console.error("Error listening to posted jobs:", error);
                    addToast("Failed to load your posted jobs.", 'error');
                });
                return () => unsubscribePostedJobs();
            }
        }
    }, [db, userId, user, appId, addToast]);

    // Fetch all users for recruiter to see applicant names
    useEffect(() => {
        if (db && user?.type === 'recruiter') {
            const usersCollectionRef = collection(db, `artifacts/${appId}/users`);
            const unsubscribeUsers = onSnapshot(usersCollectionRef, (snapshot) => {
                const usersData = [];
                snapshot.docs.forEach(userDoc => {
                    const profileDocRef = doc(userDoc.ref, 'profile', 'data');
                    getDoc(profileDocRef).then(profileSnap => {
                        if (profileSnap.exists()) {
                            usersData.push({ id: userDoc.id, ...profileSnap.data() });
                        }
                    }).catch(e => console.error("Error fetching user profile for all users:", e));
                });
                setAllUsers(usersData);
            }, (error) => {
                console.error("Error listening to all users:", error);
                addToast("Failed to load all user data.", 'error');
            });
            return () => unsubscribeUsers();
        }
    }, [db, user, appId, addToast]);


    const addJob = async (jobData) => {
        if (db && userId) {
            try {
                const jobsCollectionRef = collection(db, `artifacts/${appId}/public/data/jobs`);
                await addDoc(jobsCollectionRef, jobData);
            } catch (e) {
                console.error("Error adding job: ", e);
                addToast("Failed to post job.", 'error');
            }
        }
    };

    const updateUserProfile = async (uid, profileData) => {
        if (db) {
            try {
                const userDocRef = doc(db, `artifacts/${appId}/users/${uid}/profile`, 'data');
                await setDoc(userDocRef, profileData, { merge: true });
                setUser(prev => ({ ...prev, ...profileData })); // Update local state immediately
            } catch (e) {
                console.error("Error updating user profile: ", e);
                addToast("Failed to update profile.", 'error');
            }
        }
    };

    const applyForJob = async (jobId) => {
        if (db && userId && user) {
            try {
                // Check if already applied
                if (user.appliedJobs && user.appliedJobs.some(app => app.jobId === jobId)) {
                    addToast('You have already applied for this job.', 'info');
                    return;
                }

                // 1. Add applicant to job's applicants array
                const jobDocRef = doc(db, `artifacts/${appId}/public/data/jobs`, jobId);
                await updateDoc(jobDocRef, {
                    applicants: arrayUnion(userId)
                });

                // 2. Add job to user's appliedJobs array
                const userDocRef = doc(db, `artifacts/${appId}/users/${userId}/profile`, 'data');
                await updateDoc(userDocRef, {
                    appliedJobs: arrayUnion({ jobId: jobId, appliedDate: new Date().toISOString() })
                });

                // Update local state for applied jobs
                setAppliedJobs(prev => {
                    const jobToUpdate = jobs.find(j => j.id === jobId);
                    if (jobToUpdate && !prev.some(aj => aj.id === jobId)) {
                        return [...prev, { ...jobToUpdate, appliedDate: new Date().toISOString() }];
                    }
                    return prev;
                });
                addToast('Application submitted successfully!', 'success');

            } catch (e) {
                console.error("Error applying for job: ", e);
                addToast("Failed to apply for job.", 'error');
            }
        }
    };

    const handleSaveJob = async (jobId) => {
        if (!user || user.type !== 'jobSeeker') {
            addToast('Please login as a Job Seeker to save jobs.', 'error');
            return;
        }
        if (db && userId) {
            try {
                const userDocRef = doc(db, `artifacts/${appId}/users/${userId}/profile`, 'data');
                const isCurrentlySaved = user.savedJobs && user.savedJobs.some(job => job.jobId === jobId);

                if (isCurrentlySaved) {
                    // Remove from saved jobs
                    await updateDoc(userDocRef, {
                        savedJobs: arrayRemove(user.savedJobs.find(job => job.jobId === jobId))
                    });
                    setSavedJobs(prev => prev.filter(job => job.id !== jobId));
                    addToast('Job unsaved.', 'info');
                } else {
                    // Add to saved jobs
                    await updateDoc(userDocRef, {
                        savedJobs: arrayUnion({ jobId: jobId, savedDate: new Date().toISOString() })
                    });
                    const jobToSave = jobs.find(j => j.id === jobId);
                    if (jobToSave) {
                        setSavedJobs(prev => [...prev, { ...jobToSave, savedDate: new Date().toISOString() }]);
                    }
                    addToast('Job saved successfully!', 'success');
                }
            } catch (e) {
                console.error("Error saving/unsaving job: ", e);
                addToast("Failed to save/unsave job.", 'error');
            }
        }
    };

    const isJobSaved = useCallback((jobId) => {
        return user?.savedJobs?.some(job => job.jobId === jobId) || false;
    }, [user]);


    const renderPage = () => {
        switch (currentPage) {
            case 'home':
                return (
                    <div className="container mx-auto p-6 text-center">
                        <h1 className="text-5xl font-extrabold text-gray-900 mb-6 leading-tight">
                            Welcome to <span className="text-blue-700">JobConnect</span>
                        </h1>
                        <p className="text-xl text-gray-700 mb-8 max-w-3xl mx-auto">
                            Your ultimate platform to find your dream job or the perfect candidate.
                            Connect, apply, and track with ease.
                        </p>
                        <div className="flex justify-center space-x-4 flex-wrap gap-4">
                            <button
                                onClick={() => setCurrentPage('jobListings')}
                                className="bg-blue-600 hover:bg-blue-700 text-white text-xl font-bold py-3 px-8 rounded-lg shadow-lg transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
                            >
                                Find Jobs
                            </button>
                            {user?.type === 'recruiter' && (
                                <button
                                    onClick={() => setCurrentPage('postJob')}
                                    className="bg-green-600 hover:bg-green-700 text-white text-xl font-bold py-3 px-8 rounded-lg shadow-lg transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
                                >
                                    Post a Job
                                </button>
                            )}
                            <button
                                onClick={() => setCurrentPage('profile')}
                                className="bg-purple-600 hover:bg-purple-700 text-white text-xl font-bold py-3 px-8 rounded-lg shadow-lg transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50"
                            >
                                Build Profile
                            </button>
                        </div>

                        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                            <FeatureCard
                                icon={<Briefcase className="w-12 h-12 text-blue-600" />}
                                title="Extensive Job Listings"
                                description="Explore thousands of job opportunities across various industries and locations."
                            />
                            <FeatureCard
                                icon={<FileText className="w-12 h-12 text-green-600" />}
                                title="Easy Application Process"
                                description="Apply to jobs seamlessly with your uploaded resume and comprehensive profile."
                            />
                            <FeatureCard
                                icon={<Lightbulb className="w-12 h-12 text-purple-600" />}
                                title="AI-Powered Recommendations"
                                description="Receive personalized job suggestions tailored to your skills and experience."
                            />
                        </div>
                    </div>
                );
            case 'jobListings':
                return <JobListingPage jobs={jobs} setCurrentPage={setCurrentPage} setSelectedJob={setSelectedJob} user={user} onSaveJob={handleSaveJob} />;
            case 'jobDetail':
                return <JobDetailPage job={selectedJob} setCurrentPage={setCurrentPage} applyForJob={applyForJob} user={user} onSaveJob={handleSaveJob} isJobSaved={isJobSaved} />;
            case 'postJob':
                return <PostJobPage userId={userId} addJob={addJob} />;
            case 'profile':
                return <ProfilePage user={user} userId={userId} updateUserProfile={updateUserProfile} appliedJobs={appliedJobs} postedJobs={postedJobs} allUsers={allUsers} savedJobs={savedJobs} onSaveJob={handleSaveJob} />;
            case 'aiRecommendations':
                return <AIRecommendationsPage user={user} jobs={jobs} />;
            case 'chatbot':
                return <ChatbotPage />;
            default:
                return null;
        }
    };

    const FeatureCard = ({ icon, title, description }) => (
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 flex flex-col items-center text-center transform hover:scale-105 transition-transform duration-300">
            <div className="mb-4">{icon}</div>
            <h3 className="text-2xl font-bold text-gray-800 mb-3">{title}</h3>
            <p className="text-gray-600">{description}</p>
        </div>
    );

    return (
        <AppContext.Provider value={{ db, auth, userId, user }}>
            <div className="min-h-screen bg-gray-100 font-inter">
                <Navbar setCurrentPage={setCurrentPage} user={user} userId={userId} />
                <main className="py-8">
                    {renderPage()}
                </main>
            </div>
        </AppContext.Provider>
    );
};

const App = () => {
    return (
        <ToastContainer>
            <AppContent />
        </ToastContainer>
    );
};

export default App;
