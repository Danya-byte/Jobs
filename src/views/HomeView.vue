<template>
<div class="container" @click="handleClickOutside">
    <nav class="nav-bar">
        <RouterLink :to="{ path: `/profile/${currentUserId}`, query: { username: currentUsername } }" class="profile-link">
            <img :src="userPhoto || 'https://i.postimg.cc/3RcrzSdP/2d29f4d64bf746a8c6e55370c9a224c0.webp'" class="profile-icon" loading="lazy">
            <div class="user-name" v-if="userFirstName || userLastName">
                <span class="first-name">{{ userFirstName }}</span>
            </div>
        </RouterLink>
        <button v-if="isAdmin" @click="showAddJobModal" class="add-button"><span></span> Add Jobs</button>
        <a v-else href="https://t.me/workiks_admin" class="add-button"><span></span> Add Jobs</a>
    </nav>

    <div class="content">
        <div class="categories">
            <button class="category-btn" :class="{ active: activeFilter === 'all' }" @click="activeFilter = 'all'">Jobs</button>
            <button class="category-btn" :class="{ active: activeFilter === 'favorites' }" @click="activeFilter = 'favorites'">Favorites</button>
            <RouterLink to="#"><button class="category-btn">Gift</button></RouterLink>
        </div>

        <div class="search-container">
            <input v-model="searchQuery" type="text" placeholder="Search by position..." class="search-input" ref="searchInput">
        </div>

        <div class="jobs-scroll-container">
            <div class="jobs-list">
                <div v-if="isLoading" class="skeleton-container">
                    <div class="skeleton-card" v-for="n in 3" :key="n"></div>
                </div>
                <button v-else @click="showJobDetails(job)" class="job-card" v-for="job in filteredJobs" :key="job.id">
                    <div class="card-header">
                        <img class="job-icon" src="https://i.postimg.cc/3RcrzSdP/2d29f4d64bf746a8c6e55370c9a224c0.webp" loading="lazy">
                        <div class="job-info">
                            <p class="nick">{{ job.nick }}</p>
                            <p class="work">{{ job.position }}</p>
                            <p class="experience">{{ job.experience ? `${job.experience} years experience` : 'No experience specified' }}</p>
                        </div>
                    </div>
                    <p class="job-description">{{ job.description }}</p>
                    <div class="tags">
                        <span v-for="(tag, i) in job.tags" :key="i" class="tag">{{ tag }}</span>
                    </div>
                    <span v-if="isNew(job)" class="new-label">new</span>
                </button>
            </div>
        </div>
    </div>

    <transition name="slide-up">
        <div v-if="showAddModal" class="modal-overlay" @click.self="showAddModal = false">
            <div class="modal">
                <div class="modal-header">
                    <h2>Add New Job</h2>
                    <button class="close-btn" @click="showAddModal = false">×</button>
                </div>
                <div class="job-details">
                    <input v-model="newJob.userId" placeholder="User ID (e.g., 1029594875)" class="search-input" type="number">
                    <input v-model="newJob.nick" placeholder="Nick" class="search-input">
                    <input v-model="newJob.username" placeholder="Username (optional)" class="search-input">
                    <input v-model="newJob.position" placeholder="Position" class="search-input">
                    <input v-model.number="newJob.experience" placeholder="Experience (years)" class="search-input" type="number" min="0">
                    <textarea v-model="newJob.description" placeholder="Description" class="search-input"></textarea>
                    <input v-model="requirementsInput" @keyup.enter="addRequirement" placeholder="Requirements (Enter to add)" class="search-input">
                    <ul class="requirements">
                        <li v-for="(req, i) in newJob.requirements" :key="i">
                            {{ req }} <button @click="newJob.requirements.splice(i, 1)" class="delete-req">×</button>
                        </li>
                    </ul>
                    <input v-model="tagsInput" @keyup.enter="addTag" placeholder="Tags (Enter to add)" class="search-input">
                    <div class="tags">
                        <span v-for="(tag, i) in newJob.tags" :key="i" class="tag">
                            {{ tag }} <button @click="newJob.tags.splice(i, 1)" class="delete-tag">×</button>
                        </span>
                    </div>
                    <input v-model="newJob.contact" placeholder="Contact link" class="search-input">
                    <button @click="submitJob" class="contact-btn">Submit Job</button>
                </div>
            </div>
        </div>
    </transition>

    <transition name="slide-up">
        <div v-if="open" class="modal-overlay" @click.self="open = false">
            <div class="modal">
                <div class="modal-header">
                    <h2>{{ selectedJob.position }}</h2>
                    <button class="close-btn" @click="open = false">×</button>
                </div>
                <div class="job-details">
                    <div class="user-info">
                        <img :src="jobIcon" class="job-icon" loading="lazy">
                        <div>
                            <p class="nickname">{{ selectedJob.nick }}</p>
                            <p class="experience">{{ selectedJob.experience ? `${selectedJob.experience} years experience` : 'No experience specified' }}</p>
                        </div>
                        <button class="favorite-btn" @click="toggleFavorite(selectedJob.id)">
                            <span :class="{ 'favorite': isFavorite(selectedJob.id) }">♥</span>
                        </button>
                    </div>
                    <div class="section">
                        <h3>Description</h3>
                        <p class="description">{{ selectedJob.description }}</p>
                    </div>
                    <div class="section">
                        <h3>Requirements</h3>
                        <ul class="requirements">
                            <li v-for="(req, i) in selectedJob.requirements" :key="i">{{ req }}</li>
                        </ul>
                    </div>
                    <div class="section">
                        <h3>Skills</h3>
                        <div class="tags">
                            <span v-for="(tag, i) in selectedJob.tags" :key="i" class="tag">{{ tag }}</span>
                        </div>
                    </div>
                    <a :href="selectedJob.contact || 'https://t.me/workiks_admin'" class="contact-btn" target="_blank">Contact via Telegram</a>
                    <button v-if="isAdmin" @click="deleteJob(selectedJob.id)" class="delete-btn">Delete Job</button>
                </div>
            </div>
        </div>
    </transition>
</div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';

const BASE_URL = 'https://impotently-dutiful-hare.cloudpub.ru';

const open = ref(false);
const showAddModal = ref(false);
const selectedJob = ref({});
const userPhoto = ref('');
const userFirstName = ref('');
const userLastName = ref('');
const currentUserId = ref('');
const currentUsername = ref('');
const isAdmin = ref(false);
const jobIcon = 'https://i.postimg.cc/3RcrzSdP/2d29f4d64bf746a8c6e55370c9a224c0.webp';
const searchQuery = ref('');
const searchInput = ref(null);
const jobs = ref([]);
const isLoading = ref(true);
const favoriteJobs = ref(JSON.parse(localStorage.getItem('favoriteJobs')) || []);
const activeFilter = ref('all');
const newJob = ref({
    userId: '',
    nick: '',
    username: '',
    position: '',
    experience: null,
    description: '',
    requirements: [],
    tags: [],
    contact: ''
});
const requirementsInput = ref('');
const tagsInput = ref('');

const sortedJobs = computed(() => {
  return [...jobs.value].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
});

const filteredJobs = computed(() => {
  let filtered = sortedJobs.value;
  if (activeFilter.value === 'favorites') {
    filtered = filtered.filter(job => isFavorite(job.id));
  }
  if (!searchQuery.value) return filtered;
  const query = searchQuery.value.toLowerCase();
  return filtered.filter(job => job.position.toLowerCase().includes(query));
});

const isNew = (job) => {
  const now = new Date();
  const jobDate = new Date(job.createdAt);
  const diffInDays = (now - jobDate) / (1000 * 60 * 60 * 24);
  return diffInDays <= 3;
};

const fetchJobs = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/api/jobs`, { timeout: 5000 });
    jobs.value = response.data;
  } catch (error) {
    console.error('Error fetching jobs:', error);
  } finally {
    isLoading.value = false;
  }
};

const showJobDetails = (job) => {
  selectedJob.value = job;
  open.value = true;
};

const showAddJobModal = () => {
  newJob.value = {
    userId: '',
    nick: '',
    username: '',
    position: '',
    experience: null,
    description: '',
    requirements: [],
    tags: [],
    contact: ''
  };
  showAddModal.value = true;
};

const addRequirement = () => {
  if (requirementsInput.value.trim()) {
    newJob.value.requirements.push(requirementsInput.value.trim());
    requirementsInput.value = '';
  }
};

const addTag = () => {
  if (tagsInput.value.trim()) {
    newJob.value.tags.push(tagsInput.value.trim());
    tagsInput.value = '';
  }
};

const submitJob = async () => {
  if (!newJob.value.userId) {
    alert("Please enter a User ID");
    return;
  }
  try {
    const response = await axios.post(`${BASE_URL}/api/jobs`, newJob.value, {
      headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData }
    });
    jobs.value.push(response.data.job);
    showAddModal.value = false;
  } catch (error) {
    console.error('Error submitting job:', error.response?.data || error.message);
  }
};

const deleteJob = async (jobId) => {
  try {
    await axios.delete(`${BASE_URL}/api/jobs/${jobId}`, {
      headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData }
    });
    jobs.value = jobs.value.filter(job => job.id !== jobId);
    open.value = false;
  } catch (error) {
    console.error('Error deleting job:', error.response?.data || error.message);
  }
};

const checkAdminStatus = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/api/isAdmin`, {
      headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData }
    });
    isAdmin.value = response.data.isAdmin;
  } catch (error) {
    console.error('Error checking admin status:', error);
    isAdmin.value = false;
  }
};

const handleClickOutside = (event) => {
  if (searchInput.value && !searchInput.value.contains(event.target)) {
    searchInput.value.blur();
  }
};

const toggleFavorite = (jobId) => {
  const index = favoriteJobs.value.indexOf(jobId);
  if (index === -1) {
    favoriteJobs.value.push(jobId);
  } else {
    favoriteJobs.value.splice(index, 1);
  }
  localStorage.setItem('favoriteJobs', JSON.stringify(favoriteJobs.value));
};

const isFavorite = (jobId) => favoriteJobs.value.includes(jobId);

onMounted(() => {
  if (window.Telegram?.WebApp) {
    Telegram.WebApp.ready();
    Telegram.WebApp.expand();
    Telegram.WebApp.disableVerticalSwipes();

    if (window.Telegram.WebApp.initDataUnsafe?.user) {
      const user = Telegram.WebApp.initDataUnsafe.user;
      userPhoto.value = user.photo_url || `https://t.me/i/userpic/160/${user.username}.jpg`;
      userFirstName.value = user.first_name || '';
      userLastName.value = user.last_name || '';
      currentUserId.value = user.id;
      currentUsername.value = user.username;
    }
  }
  checkAdminStatus();
  fetchJobs();
});
</script>

<style scoped>
.container { background: linear-gradient(45deg, #101622, #1a2233); min-height: 100vh; padding: 20px; overflow: hidden; position: relative; }
.nav-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
.profile-link { display: flex; align-items: center; gap: 10px; text-decoration: none; }
.profile-icon { width: 47px; height: 47px; border-radius: 50%; border: 2px solid #97f492; position: relative; overflow: hidden; animation: pulse-border 2s infinite; }
@keyframes pulse-border { 0% { box-shadow: 0 0 0 0 rgba(151, 244, 146, 0.7); } 70% { box-shadow: 0 0 0 10px rgba(151, 244, 146, 0); } 100% { box-shadow: 0 0 0 0 rgba(151, 244, 146, 0); } }
.user-name { display: flex; flex-direction: column; gap: 2px; }
.first-name { font-size: 16px; font-weight: 600; animation: fade-in 0.5s ease-in-out, color-change 5s infinite; }
@keyframes color-change { 0% { color: #97f492; } 50% { color: #6de06a; } 100% { color: #97f492; } }
.add-button { background: linear-gradient(135deg, #97f492 0%, #6de06a 100%); padding: 8px 20px; border-radius: 30px; color: #000; font-weight: 400; box-shadow: 0 4px 15px rgba(151, 244, 146, 0.3); transition: 0.3s; font-size: 14px; text-decoration: none; animation: pulse 2s infinite; }
.add-button:hover { transform: translateY(-2px); }
.categories { display: flex; gap: 15px; margin-bottom: 20px; flex-shrink: 0; }
.category-btn { background: #272e38; color: #fff; border: none; padding: 10px 25px; border-radius: 12px; cursor: pointer; transition: 0.3s; font-size: 14px; font-weight: 600; }
.category-btn.active { background: #97f492; color: #000; animation: pulse 2s infinite; }
.search-container { margin-bottom: 20px; }
.search-input { width: 100%; padding: 12px 20px; border-radius: 12px; border: none; background: #272e38; color: #fff; font-size: 14px; transition: all 0.3s; }
.search-input:focus { outline: none; box-shadow: 0 0 0 2px #97f492; }
.search-input::placeholder { color: #6b7280; }
.content { display: flex; flex-direction: column; height: calc(100vh - 100px); }
.jobs-scroll-container { flex-grow: 1; overflow-y: auto; padding-right: 20px; margin-right: -30px; scrollbar-width: none; -ms-overflow-style: none; }
.jobs-scroll-container::-webkit-scrollbar { display: none; }
.jobs-list { display: grid; gap: 15px; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); padding-bottom: 20px; }
.job-card { background: #181e29; width: auto; min-width: 300px; border-radius: 20px; padding: 20px; border: 1px solid #2d3540; transition: transform 0.3s ease, box-shadow 0.3s ease; text-align: left; box-sizing: border-box; position: relative; }
.job-card:hover { transform: translateY(-3px); box-shadow: 0 10px 20px rgba(0,0,0,0.2); }
.job-icon { width: 40px; height: 40px; border-radius: 10px; }
.card-header { display: flex; align-items: center; gap: 15px; margin-bottom: 15px; position: relative; }
.nick { color: #97f492; font-size: 14px; margin: 0; }
.work { color: #fff; font-size: 18px; margin: 0; }
.job-description { color: #8a8f98; font-size: 14px; line-height: 1.5; }
.tags { display: flex; gap: 10px; margin-top: 15px; flex-wrap: wrap; max-width: 100%; }
.tag { background: #2d3540; color: #97f492; padding: 5px 12px; border-radius: 8px; font-size: 12px; white-space: nowrap; flex-shrink: 0; }
.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: flex-end; }
.modal { background: #181e29; width: 100%; border-radius: 20px 20px 0 0; padding: 25px; max-height: 90vh; overflow-y: auto; transform: translateY(100%); animation: slide-up 0.3s ease-out forwards; scrollbar-width: none; -ms-overflow-style: none; }
.modal::-webkit-scrollbar { display: none; }
@keyframes slide-up { to { transform: translateY(0); } }
.modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; }
.modal-header h2 { color: #97f492; margin: 0; }
.close-btn { background: none; border: none; color: #fff; font-size: 28px; cursor: pointer; padding: 0 10px; }
.job-details { display: flex; flex-direction: column; gap: 20px; }
.user-info { display: flex; align-items: center; gap: 15px; position: relative; }
.nickname { color: #97f492; margin: 0; font-size: 18px; }
.experience { color: #8a8f98; margin: 0; font-size: 14px; }
.section h3 { color: #fff; margin: 0 0 10px 0; font-size: 16px; }
.description { color: #c2c6cf; line-height: 1.5; margin: 0; }
.requirements { padding-left: 20px; margin: 0; color: #c2c6cf; }
.requirements li { margin-bottom: 8px; }
.contact-btn { background: linear-gradient(135deg, #97f492 0%, #6de06a 100%); color: #000; text-align: center; padding: 15px; border-radius: 12px; text-decoration: none; font-weight: 600; margin-top: 20px; transition: transform 0.2s; }
.contact-btn:hover { transform: translateY(-2px); }
.delete-btn { background: linear-gradient(135deg, #ff6b6b 0%, #ff8787 100%); color: #fff; text-align: center; padding: 15px; border-radius: 12px; border: none; font-weight: 600; margin-top: 20px; cursor: pointer; transition: transform 0.2s; }
.delete-btn:hover { transform: translateY(-2px); }
.delete-req, .delete-tag { background: none; border: none; color: #ff6b6b; cursor: pointer; margin-left: 5px; font-size: 16px; }
textarea.search-input { min-height: 100px; resize: vertical; }
.slide-up-enter-active, .slide-up-leave-active { transition: opacity 0.3s, transform 0.3s; }
.slide-up-enter-from, .slide-up-leave-to { opacity: 0; transform: translateY(100%); }
@keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }
.skeleton-container { display: grid; gap: 15px; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); }
.skeleton-card { background: #181e29; border-radius: 20px; padding: 20px; height: 150px; animation: skeleton-loading 1.5s infinite; }
@keyframes skeleton-loading { 0% { background-color: #181e29; } 50% { background-color: #272e38; } 100% { background-color: #181e29; } }
.new-label { position: absolute; top: 10px; right: 10px; background: #97f492; color: #000; padding: 2px 6px; border-radius: 4px; font-size: 12px; }
.favorite-btn { background: none; border: none; font-size: 30px; cursor: pointer; padding: 0; position: absolute; right: 10px; top: 3px; }
.favorite-btn span { color: #8a8f98; transition: color 0.3s; }
.favorite-btn .favorite { color: #97f492; }
</style>