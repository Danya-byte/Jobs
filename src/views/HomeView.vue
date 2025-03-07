<template>
<div class="container" @click="handleClickOutside">
    <nav class="nav-bar">
        <RouterLink :to="{ path: `/profile/${currentUserId}`, query: { username: currentUsername } }" class="profile-link">
            <img :src="userPhoto || 'https://i.postimg.cc/3RcrzSdP/2d29f4d64bf746a8c6e55370c9a224c0.webp'" class="profile-icon" loading="lazy">
            <div class="user-name" v-if="userFirstName || userLastName">
                <span class="first-name">{{ userFirstName }}</span>
            </div>
        </RouterLink>
        <button @click="handleAddJobsClick" class="add-button"><span></span> Add Jobs</button>
    </nav>

    <div class="content">
        <div class="categories">
            <button class="category-btn" :class="{ active: activeTab === 'jobs' }" @click="activeTab = 'jobs'">Jobs</button>
            <button class="category-btn" :class="{ active: activeTab === 'companies' }" @click="activeTab = 'companies'">Companies</button>
            <button class="category-btn" :class="{ active: activeTab === 'tasks' }" @click="activeTab = 'tasks'">Tasks</button>
        </div>

        <div class="search-and-filter">
            <div class="search-container">
                <input v-model="searchQuery" type="text" placeholder="Search by position..." class="search-input" ref="searchInput">
            </div>
            <button class="filter-icon" @click="toggleFilterModal">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#97f492" stroke-width="2">
                    <path d="M22 3H2l8 9.46V19l4 2V12.46L22 3z"/>
                </svg>
            </button>
        </div>

        <div class="selected-filters" v-if="selectedCategories.length > 0">
            <span v-for="cat in selectedCategories" class="filter-pill">
                {{ categories.find(c => c.value === cat).label }}
                <button @click="selectedCategories = selectedCategories.filter(c => c !== cat)">×</button>
            </span>
        </div>

        <div class="jobs-scroll-container">
            <div class="jobs-list" v-if="activeTab === 'jobs'">
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
                    <span v-if="job.pinned" class="pinned-label">📌Pinned</span>
                </button>
            </div>
            <div class="jobs-list" v-if="activeTab === 'companies'">
                <div v-if="isLoading" class="skeleton-container">
                    <div class="skeleton-card" v-for="n in 3" :key="n"></div>
                </div>
                <button v-else @click="showVacancyDetails(vacancy)" class="job-card" v-for="vacancy in filteredVacancies" :key="vacancy.id">
                    <div class="card-header">
                        <img :src="vacancy.photoUrl" class="job-icon" loading="lazy" @error="handleImageError">
                        <div class="job-info">
                            <p class="nick">{{ vacancy.companyName }} <span v-if="vacancy.verified" class="verified-label">Verified</span></p>
                            <p class="work">{{ vacancy.position }}</p>
                            <p class="experience">{{ vacancy.description.slice(0, 50) + '...' }}</p>
                        </div>
                    </div>
                    <div class="tags">
                        <span v-for="(tag, i) in vacancy.tags" :key="i" class="tag">{{ tag }}</span>
                    </div>
                    <span v-if="isNew(vacancy)" class="new-label">new</span>
                    <span v-if="vacancy.pinned" class="pinned-label">📌Pinned</span>
                </button>
            </div>
            <div class="jobs-list" v-if="activeTab === 'tasks'">
                <div v-if="isLoading" class="skeleton-container">
                    <div class="skeleton-card" v-for="n in 3" :key="n"></div>
                </div>
                <button v-else @click="showTaskDetails(task)" class="job-card" v-for="task in filteredTasks" :key="task.id">
                    <div class="card-header">
                        <img class="job-icon" :src="task.photoUrl || 'https://i.postimg.cc/3RcrzSdP/2d29f4d64bf746a8c6e55370c9a224c0.webp'" loading="lazy">
                        <div class="job-info">
                            <p class="nick">{{ task.title }}</p>
                            <p class="work">{{ task.reward }} XTR</p>
                            <p class="experience">{{ task.deadline ? `Deadline: ${new Date(task.deadline).toLocaleDateString()}` : 'No deadline' }}</p>
                        </div>
                    </div>
                    <p class="job-description">{{ task.description }}</p>
                    <div class="tags">
                        <span v-for="(tag, i) in task.tags" :key="i" class="tag">{{ tag }}</span>
                    </div>
                    <span v-if="isNew(task)" class="new-label">new</span>
                    <span v-if="task.pinned" class="pinned-label">📌Pinned</span>
                </button>
            </div>
        </div>

        <transition name="fade">
            <div v-if="showFilterModal" class="filter-modal-overlay" @click.self="showFilterModal = false">
                <div class="filter-modal">
                    <h3>Filters</h3>
                    <div class="filter-section">
                        <h4>Categories</h4>
                        <label v-for="category in categories" :key="category.value" class="checkbox-label">
                            <input type="checkbox" v-model="selectedCategories" :value="category.value">
                            {{ category.label }}
                        </label>
                    </div>
                    <div class="filter-section">
                        <label class="checkbox-label">
                            <input type="checkbox" v-model="showFavoritesOnly">
                            Show Favorites Only
                        </label>
                    </div>
                    <button @click="showFilterModal = false" class="apply-btn">Apply</button>
                </div>
            </div>
        </transition>

        <transition name="fade">
            <div v-if="showAdminModal" class="admin-modal-overlay" @click.self="showAdminModal = false">
                <div class="modal admin-selection-modal">
                    <div class="modal-header">
                        <h2>Select Item Type</h2>
                        <button class="close-btn" @click="showAdminModal = false">×</button>
                    </div>
                    <div class="selection-buttons">
                        <button @click="showAddJobModal" class="selection-btn">Add Job</button>
                        <button @click="showAddVacancyModal" class="selection-btn">Add Vacancy</button>
                        <button @click="showAddTaskModal" class="selection-btn">Add Task</button>
                    </div>
                </div>
            </div>
        </transition>

        <transition name="slide-up">
            <div v-if="showAddModal" class="modal-overlay" @click.self="showAddModal = false">
                <div class="modal">
                    <div class="modal-header">
                        <h2>{{ addMode === 'job' ? 'Add New Job' : 'Add New Vacancy' }}</h2>
                        <button class="close-btn" @click="showAddModal = false">×</button>
                    </div>
                    <div class="job-details">
                        <input v-if="addMode === 'vacancy'" v-model="newItem.companyUserId" placeholder="Company User ID (e.g., 1234567890)" class="search-input" type="number" :class="{ 'invalid': !newItem.companyUserId && formSubmitted }">
                        <input v-if="addMode === 'vacancy'" v-model="newItem.companyName" placeholder="Company Name" class="search-input" :class="{ 'invalid': !newItem.companyName && formSubmitted }">
                        <input v-if="addMode === 'job'" v-model="newItem.userId" placeholder="User ID (e.g., 1029594875)" class="search-input" type="number" :class="{ 'invalid': !newItem.userId && formSubmitted }">
                        <input v-if="addMode === 'job'" v-model="newItem.nick" placeholder="Nick" class="search-input" :class="{ 'invalid': !newItem.nick && formSubmitted }">
                        <input v-if="addMode === 'job'" v-model="newItem.username" placeholder="Username (optional)" class="search-input">
                        <input v-model="newItem.position" placeholder="Position" class="search-input" :class="{ 'invalid': !newItem.position && formSubmitted }">
                        <input v-if="addMode === 'job'" v-model="newItem.experience" placeholder="Experience (years)" class="search-input" type="number" min="0">
                        <textarea v-model="newItem.description" placeholder="Description" class="search-input" :class="{ 'invalid': !newItem.description && formSubmitted }"></textarea>
                        <input v-model="requirementsInput" @keyup.enter="addRequirement" placeholder="Requirements (Enter to add)" class="search-input">
                        <ul class="requirements">
                            <li v-for="(req, i) in newItem.requirements" :key="i">
                                {{ req }} <button @click="newItem.requirements.splice(i, 1)" class="delete-req">×</button>
                            </li>
                        </ul>
                        <input v-model="tagsInput" @keyup.enter="addTag" placeholder="Tags (Enter to add)" class="search-input">
                        <div class="tags">
                            <span v-for="(tag, i) in newItem.tags" :key="i" class="tag">
                                {{ tag }} <button @click="newItem.tags.splice(i, 1)" class="delete-tag">×</button>
                            </span>
                        </div>
                        <div class="filter-section">
                            <h4>Categories</h4>
                            <label v-for="category in categories" :key="category.value" class="checkbox-label">
                                <input type="checkbox" v-model="newItem.categories" :value="category.value">
                                {{ category.label }}
                            </label>
                        </div>
                        <input v-model="newItem.contact" placeholder="Contact (e.g., https://t.me/username)" class="search-input" :class="{ 'invalid': !newItem.contact && formSubmitted }">
                        <input v-if="addMode === 'vacancy'" v-model="newItem.officialWebsite" placeholder="Official Website (e.g., https://company.com)" class="search-input" :class="{ 'invalid': !newItem.officialWebsite && formSubmitted }">
                        <input v-if="addMode === 'vacancy'" v-model="newItem.photoUrl" placeholder="Photo URL" class="search-input" :class="{ 'invalid': !newItem.photoUrl && formSubmitted }">
                        <label v-if="addMode === 'vacancy'" class="checkbox-label">
                            <input type="checkbox" v-model="newItem.verified"> Verified
                        </label>
                        <button @click="submitItem" class="contact-btn">Submit</button>
                    </div>
                </div>
            </div>
        </transition>

        <transition name="slide-up">
            <div v-if="showTaskModal" class="modal-overlay" @click.self="showTaskModal = false">
                <div class="modal">
                    <div class="modal-header">
                        <h2>Add New Task</h2>
                        <button class="close-btn" @click="showTaskModal = false">×</button>
                    </div>
                    <div class="job-details">
                        <input v-model="newTask.title" placeholder="Task Title" class="search-input" :class="{ 'invalid': !newTask.title && formSubmitted }" />
                        <input v-model="newTask.reward" placeholder="Reward (XTR)" type="number" min="1" class="search-input" :class="{ 'invalid': !newTask.reward && formSubmitted }" />
                        <input v-model="newTask.deadline" type="date" placeholder="Deadline" class="search-input" />
                        <textarea v-model="newTask.description" placeholder="Description" class="search-input" :class="{ 'invalid': !newTask.description && formSubmitted }"></textarea>
                        <input v-model="tagsInput" @keyup.enter="addTaskTag" placeholder="Tags (Enter to add)" class="search-input" />
                        <div class="tags">
                            <span v-for="(tag, i) in newTask.tags" :key="i" class="tag">
                                {{ tag }} <button @click="newTask.tags.splice(i, 1)" class="delete-tag">×</button>
                            </span>
                        </div>
                        <div class="filter-section">
                            <h4>Categories</h4>
                            <label v-for="category in categories" :key="category.value" class="checkbox-label">
                                <input type="checkbox" v-model="newTask.categories" :value="category.value">
                                {{ category.label }}
                            </label>
                        </div>
                        <input v-model="newTask.contact" placeholder="Contact (e.g., https://t.me/username)" class="search-input" :class="{ 'invalid': !newTask.contact && formSubmitted }" />
                        <input v-model="newTask.photoUrl" placeholder="Photo URL (optional)" class="search-input" />
                        <button @click="submitTask" class="contact-btn">Submit Task</button>
                    </div>
                </div>
            </div>
        </transition>

        <transition name="slide-up">
            <div v-if="open" class="modal-overlay" @click.self="open = false">
                <div class="modal">
                    <div class="modal-header">
                        <h2>{{ isVacancy ? selectedVacancy.position : isTask ? selectedTask.title : selectedJob.position }}</h2>
                        <button class="close-btn" @click="open = false">×</button>
                    </div>
                    <div class="job-details" v-if="isVacancy">
                        <div class="user-info">
                            <a :href="selectedVacancy.officialWebsite" target="_blank" class="company-link">
                                <img :src="selectedVacancy.photoUrl" class="job-icon" loading="lazy" @error="handleImageError">
                                <div>
                                    <p class="nickname">{{ selectedVacancy.companyName }} <span v-if="selectedVacancy.verified" class="verified-label">Verified</span></p>
                                </div>
                            </a>
                            <button class="favorite-btn" @click="toggleFavorite(selectedVacancy.id)">
                                <span :class="{ 'favorite': isFavorite(selectedVacancy.id) }">♥</span>
                            </button>
                        </div>
                        <div class="section">
                            <h3>Description</h3>
                            <p class="description">{{ selectedVacancy.description }}</p>
                        </div>
                        <div class="section">
                            <h3>Requirements</h3>
                            <ul class="requirements">
                                <li v-for="(req, i) in selectedVacancy.requirements" :key="i">{{ req }}</li>
                            </ul>
                        </div>
                        <div class="section">
                            <h3>Skills</h3>
                            <div class="tags">
                                <span v-for="(tag, i) in selectedVacancy.tags" :key="i" class="tag">{{ tag }}</span>
                            </div>
                        </div>
                        <div v-if="isAdmin" class="pin-section">
                            <label>
                                <input type="checkbox" v-model="selectedVacancy.pinned" @change="togglePinned(selectedVacancy)">
                                Закрепить вверху
                            </label>
                        </div>
                        <a :href="selectedVacancy.contact" class="contact-btn" target="_blank">Contact via Telegram</a>
                        <button v-if="isAdmin" @click="deleteVacancy(selectedVacancy.id)" class="delete-btn">Delete Vacancy</button>
                    </div>
                    <div class="job-details" v-else-if="isTask">
                        <div class="user-info">
                            <img :src="selectedTask.photoUrl || jobIcon" class="job-icon" loading="lazy" @error="handleImageError">
                            <div>
                                <p class="nickname">{{ selectedTask.title }}</p>
                                <p class="experience">{{ selectedTask.reward }} XTR</p>
                                <p class="experience">{{ selectedTask.deadline ? `Deadline: ${new Date(selectedTask.deadline).toLocaleDateString()}` : 'No deadline' }}</p>
                            </div>
                            <button class="favorite-btn" @click="toggleFavorite(selectedTask.id)">
                                <span :class="{ 'favorite': isFavorite(selectedTask.id) }">♥</span>
                            </button>
                        </div>
                        <div class="section">
                            <h3>Description</h3>
                            <p class="description">{{ selectedTask.description }}</p>
                        </div>
                        <div class="section">
                            <h3>Skills</h3>
                            <div class="tags">
                                <span v-for="(tag, i) in selectedTask.tags" :key="i" class="tag">{{ tag }}</span>
                            </div>
                        </div>
                        <div v-if="isAdmin" class="pin-section">
                            <label>
                                <input type="checkbox" v-model="selectedTask.pinned" @change="togglePinned(selectedTask)">
                                Закрепить вверху
                            </label>
                        </div>
                        <a :href="selectedTask.contact" class="contact-btn" target="_blank">Contact via Telegram</a>
                        <button v-if="isAdmin" @click="deleteTask(selectedTask.id)" class="delete-btn">Delete Task</button>
                    </div>
                    <div class="job-details" v-else>
                        <div class="user-info">
                            <RouterLink
                                :to="{
                                    path: `/profile/${selectedJob.userId}`,
                                    query: { username: selectedJob.username }
                                }"
                                class="profile-link"
                            >
                                <img :src="jobIcon" class="job-icon" loading="lazy">
                                <div>
                                    <p class="nickname">{{ selectedJob.nick }}</p>
                                    <p class="experience">{{ selectedJob.experience ? `${selectedJob.experience} years experience` : 'No experience specified' }}</p>
                                </div>
                            </RouterLink>
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
                        <div v-if="isAdmin" class="pin-section">
                            <label>
                                <input type="checkbox" v-model="selectedJob.pinned" @change="togglePinned(selectedJob)">
                                Закрепить вверху
                            </label>
                        </div>
                        <a :href="selectedJob.contact || 'https://t.me/workiks_admin'" class="contact-btn" target="_blank">Contact via Telegram</a>
                        <button v-if="isAdmin" @click="deleteJob(selectedJob.id)" class="delete-btn">Delete Job</button>
                    </div>
                </div>
            </div>
        </transition>
    </div>
</div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';

const BASE_URL = 'https://impotently-dutiful-hare.cloudpub.ru';

const open = ref(false);
const showAddModal = ref(false);
const showFilterModal = ref(false);
const showAdminModal = ref(false);
const showTaskModal = ref(false);
const selectedJob = ref({});
const selectedVacancy = ref({});
const selectedTask = ref({});
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
const vacancies = ref([]);
const tasks = ref([]);
const isLoading = ref(true);
const favoriteJobs = ref([]);
const selectedCategories = ref([]);
const showFavoritesOnly = ref(false);
const activeTab = ref('jobs');
const addMode = ref('job');
const newItem = ref({
    userId: '',
    nick: '',
    username: '',
    position: '',
    experience: null,
    description: '',
    requirements: [],
    tags: [],
    categories: [],
    contact: 'https://t.me/workiks_admin',
    companyUserId: '',
    companyName: '',
    officialWebsite: '',
    verified: false,
    photoUrl: ''
});
const newTask = ref({
    title: '',
    reward: '',
    deadline: '',
    description: '',
    tags: [],
    categories: [],
    contact: 'https://t.me/workiks_admin',
    photoUrl: ''
});
const requirementsInput = ref('');
const tagsInput = ref('');
const formSubmitted = ref(false);
const isVacancy = ref(false);
const isTask = ref(false);

const categories = [
    { label: 'IT', value: 'it' },
    { label: 'Social Media', value: 'social' },
    { label: 'Management', value: 'management' },
    { label: 'Design', value: 'design' },
    { label: 'Marketing', value: 'marketing' },
    { label: 'Finance', value: 'finance' }
];

const sortedJobs = computed(() => {
  return [...jobs.value].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
});

const filteredJobs = computed(() => {
  let filtered = sortedJobs.value;
  if (selectedCategories.value.length > 0) {
    filtered = filtered.filter(job => {
      if (job.categories && job.categories.length > 0) {
        return job.categories.some(cat => selectedCategories.value.includes(cat));
      }
      return false;
    });
  }
  if (showFavoritesOnly.value) {
    filtered = filtered.filter(job => isFavorite(job.id));
  }
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(job => job.position.toLowerCase().includes(query));
  }
  return filtered;
});

const filteredVacancies = computed(() => {
  let filtered = [...vacancies.value].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
  if (selectedCategories.value.length > 0) {
    filtered = filtered.filter(vacancy => vacancy.categories.some(cat => selectedCategories.value.includes(cat)));
  }
  if (showFavoritesOnly.value) {
    filtered = filtered.filter(vacancy => isFavorite(vacancy.id));
  }
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(vacancy => vacancy.position.toLowerCase().includes(query));
  }
  return filtered;
});

const sortedTasks = computed(() => {
  return [...tasks.value].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
});

const filteredTasks = computed(() => {
  let filtered = sortedTasks.value;
  if (selectedCategories.value.length > 0) {
    filtered = filtered.filter(task =>
      task.categories.some(cat => selectedCategories.value.includes(cat))
    );
  }
  if (showFavoritesOnly.value) {
    filtered = filtered.filter(task => isFavorite(task.id));
  }
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(task =>
      task.title.toLowerCase().includes(query)
    );
  }
  return filtered;
});

const isNew = (item) => {
  const now = new Date();
  const itemDate = new Date(item.createdAt);
  const diffInDays = (now - itemDate) / (1000 * 60 * 60 * 24);
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

const fetchVacancies = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/api/vacancies`, { timeout: 5000 });
    vacancies.value = response.data;
  } catch (error) {
    console.error('Error fetching vacancies:', error);
  }
};

const fetchTasks = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/api/tasks`, { timeout: 5000 });
    tasks.value = response.data;
  } catch (error) {
    console.error('Error fetching tasks:', error);
  } finally {
    isLoading.value = false;
  }
};

const fetchFavorites = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/api/favorites`, {
      headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData }
    });
    favoriteJobs.value = response.data;
  } catch (error) {
    console.error('Error fetching favorites:', error);
  }
};

const showJobDetails = (job) => {
  selectedJob.value = job;
  isVacancy.value = false;
  isTask.value = false;
  open.value = true;
};

const showVacancyDetails = (vacancy) => {
  selectedVacancy.value = vacancy;
  isVacancy.value = true;
  isTask.value = false;
  open.value = true;
};

const showTaskDetails = (task) => {
  selectedTask.value = task;
  isTask.value = true;
  isVacancy.value = false;
  open.value = true;
};

const showAddJobModal = () => {
  showAdminModal.value = false;
  newItem.value = {
    userId: '',
    nick: '',
    username: '',
    position: '',
    experience: null,
    description: '',
    requirements: [],
    tags: [],
    categories: [],
    contact: 'https://t.me/workiks_admin'
  };
  addMode.value = 'job';
  showAddModal.value = true;
};

const showAddVacancyModal = () => {
  showAdminModal.value = false;
  newItem.value = {
    companyUserId: '',
    companyName: '',
    position: '',
    description: '',
    requirements: [],
    tags: [],
    categories: [],
    contact: 'https://t.me/workiks_admin',
    officialWebsite: '',
    verified: false,
    photoUrl: ''
  };
  addMode.value = 'vacancy';
  showAddModal.value = true;
};

const showAddTaskModal = () => {
  showAdminModal.value = false;
  newTask.value = {
    title: '',
    reward: '',
    deadline: '',
    description: '',
    tags: [],
    categories: [],
    contact: 'https://t.me/workiks_admin',
    photoUrl: ''
  };
  showTaskModal.value = true;
};

const toggleFilterModal = () => {
    showFilterModal.value = !showFilterModal.value;
    if (showFilterModal.value) {
      nextTick(() => {
        const firstCheckbox = document.querySelector('.filter-modal input[type="checkbox"]');
        firstCheckbox?.focus();
      });
    }
};

const addRequirement = () => {
  if (requirementsInput.value.trim()) {
    newItem.value.requirements.push(requirementsInput.value.trim());
    requirementsInput.value = '';
  }
};

const addTag = () => {
  if (tagsInput.value.trim()) {
    newItem.value.tags.push(tagsInput.value.trim());
    tagsInput.value = '';
  }
};

const addTaskTag = () => {
  if (tagsInput.value.trim()) {
    newTask.value.tags.push(tagsInput.value.trim());
    tagsInput.value = '';
  }
};

const submitItem = async () => {
  formSubmitted.value = true;
  if (addMode.value === 'job') {
    if (!newItem.value.userId || !newItem.value.nick || !newItem.value.position || !newItem.value.description) {
      Telegram.WebApp.showAlert("Please fill in all required fields!");
      return;
    }
    try {
      const jobData = { ...newItem.value, contact: 'https://t.me/workiks_admin', categories: newItem.value.categories || [] };
      const response = await axios.post(`${BASE_URL}/api/jobs`, jobData, {
        headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData }
      });
      jobs.value.push(response.data.job);
      showAddModal.value = false;
    } catch (error) {
      console.error('Error submitting job:', error.response?.data || error.message);
    }
  } else {
    if (!newItem.value.companyUserId || !newItem.value.companyName || !newItem.value.position || !newItem.value.description || !newItem.value.contact || !newItem.value.officialWebsite || !newItem.value.photoUrl) {
      Telegram.WebApp.showAlert("Please fill in all required fields!");
      return;
    }
    try {
      const vacancyData = { ...newItem.value, categories: newItem.value.categories || [] };
      const response = await axios.post(`${BASE_URL}/api/vacancies`, vacancyData, {
        headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData }
      });
      vacancies.value.push(response.data.vacancy);
      showAddModal.value = false;
    } catch (error) {
      console.error('Error submitting vacancy:', error.response?.data || error.message);
    }
  }
};

const submitTask = async () => {
  formSubmitted.value = true;
  if (!newTask.value.title || !newTask.value.reward || !newTask.value.description || !newTask.value.contact) {
    Telegram.WebApp.showAlert("Please fill in all required fields!");
    return;
  }
  try {
    const taskData = { ...newTask.value, categories: newTask.value.categories || [] };
    const response = await axios.post(`${BASE_URL}/api/tasks`, taskData, {
      headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData }
    });
    tasks.value.push(response.data.task);
    showTaskModal.value = false;
  } catch (error) {
    console.error('Error submitting task:', error.response?.data || error.message);
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
    console.error('Error deleting job:', error);
  }
};

const deleteVacancy = async (vacancyId) => {
  try {
    await axios.delete(`${BASE_URL}/api/vacancies/${vacancyId}`, {
      headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData }
    });
    vacancies.value = vacancies.value.filter(v => v.id !== vacancyId);
    open.value = false;
  } catch (error) {
    console.error('Error deleting vacancy:', error);
  }
};

const deleteTask = async (taskId) => {
  try {
    await axios.delete(`${BASE_URL}/api/tasks/${taskId}`, {
      headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData }
    });
    tasks.value = tasks.value.filter(t => t.id !== taskId);
    open.value = false;
  } catch (error) {
    console.error('Error deleting task:', error);
  }
};

const togglePinned = async (item) => {
  const url = item.companyName
    ? `${BASE_URL}/api/vacancies/${item.id}/pinned`
    : item.title
    ? `${BASE_URL}/api/tasks/${item.id}/pinned`
    : `${BASE_URL}/api/jobs/${item.id}/pinned`;
  try {
    await axios.put(url, { pinned: item.pinned }, {
      headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData }
    });
  } catch (error) {
    console.error('Error toggling pinned:', error);
    item.pinned = !item.pinned;
  }
};

const isFavorite = (itemId) => {
  return favoriteJobs.value.includes(itemId);
};

const toggleFavorite = async (itemId) => {
  try {
    const response = await axios.post(`${BASE_URL}/api/toggleFavorite`, { itemId }, {
      headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData }
    });
    favoriteJobs.value = response.data.favorites;
  } catch (error) {
    console.error('Error toggling favorite:', error);
  }
};

const handleImageError = (event) => {
  event.target.src = jobIcon;
};

const handleAddJobsClick = () => {
  if (isAdmin.value) {
    showAdminModal.value = true;
  } else {
    Telegram.WebApp.showAlert("You don't have permission to add jobs.");
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
  }
};

const handleClickOutside = (event) => {
  if (showFilterModal.value && !event.target.closest('.filter-modal') && !event.target.closest('.filter-icon')) {
    showFilterModal.value = false;
  }
  if (showAdminModal.value && !event.target.closest('.admin-selection-modal') && !event.target.closest('.add-button')) {
    showAdminModal.value = false;
  }
};

onMounted(() => {
  fetchJobs();
  fetchVacancies();
  fetchTasks();
  fetchFavorites();
  checkAdminStatus();

  const telegram = window.Telegram.WebApp;
  telegram.ready();
  const user = telegram.initDataUnsafe.user;
  if (user) {
    userPhoto.value = user.photo_url || '';
    userFirstName.value = user.first_name || '';
    userLastName.value = user.last_name || '';
    currentUserId.value = user.id || '';
    currentUsername.value = user.username || '';
  }
});
</script>

<style scoped>
.container {
  max-width: 100%;
  margin: 0 auto;
  padding: 10px;
  background: #121212;
  min-height: 100vh;
  color: #fff;
  overflow: hidden;
}

.nav-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid #333;
}

.profile-link {
  display: flex;
  align-items: center;
  text-decoration: none;
  color: #fff;
}

.profile-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  margin-right: 10px;
}

.user-name {
  display: flex;
  flex-direction: column;
}

.first-name {
  font-size: 16px;
  font-weight: bold;
}

.add-button {
  background: #1e1e1e;
  border: 1px solid #97f492;
  color: #97f492;
  padding: 8px 16px;
  border-radius: 20px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
}

.add-button span {
  display: inline-block;
  width: 12px;
  height: 12px;
  background: #97f492;
  border-radius: 50%;
  margin-right: 8px;
}

.content {
  padding-top: 20px;
}

.categories {
  display: flex;
  justify-content: space-around;
  margin-bottom: 20px;
}

.category-btn {
  background: #1e1e1e;
  border: none;
  color: #fff;
  padding: 8px 16px;
  border-radius: 20px;
  cursor: pointer;
  font-size: 14px;
}

.category-btn.active {
  background: #97f492;
  color: #121212;
}

.search-and-filter {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
}

.search-container {
  flex-grow: 1;
  position: relative;
}

.search-input {
  width: 100%;
  padding: 10px;
  border: 1px solid #333;
  border-radius: 20px;
  background: #1e1e1e;
  color: #fff;
  font-size: 14px;
}

.search-input.invalid {
  border-color: #ff5555;
}

.filter-icon {
  background: none;
  border: none;
  cursor: pointer;
  margin-left: 10px;
}

.jobs-scroll-container {
  max-height: calc(100vh - 250px);
  overflow-y: auto;
  scrollbar-width: none;
}

.jobs-scroll-container::-webkit-scrollbar {
  display: none;
}

.jobs-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.job-card {
  background: #1e1e1e;
  border: 1px solid #333;
  border-radius: 10px;
  padding: 15px;
  text-align: left;
  color: #fff;
  cursor: pointer;
  position: relative;
  width: 100%;
  box-sizing: border-box;
}

.card-header {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.job-icon {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  margin-right: 10px;
}

.job-info {
  flex-grow: 1;
}

.nick {
  font-size: 16px;
  font-weight: bold;
  margin: 0;
}

.work {
  font-size: 14px;
  color: #97f492;
  margin: 5px 0;
}

.experience {
  font-size: 12px;
  color: #888;
  margin: 0;
}

.job-description {
  font-size: 14px;
  color: #ccc;
  margin: 10px 0;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.tag {
  background: #333;
  padding: 5px 10px;
  border-radius: 15px;
  font-size: 12px;
  color: #fff;
}

.new-label {
  position: absolute;
  top: 10px;
  right: 10px;
  background: #97f492;
  color: #121212;
  padding: 5px 10px;
  border-radius: 15px;
  font-size: 12px;
}

.pinned-label {
  position: absolute;
  top: 10px;
  right: 10px;
  background: #ff9800;
  color: #fff;
  padding: 5px 10px;
  border-radius: 15px;
  font-size: 12px;
}

.verified-label {
  background: #4caf50;
  color: #fff;
  padding: 2px 5px;
  border-radius: 10px;
  font-size: 10px;
  margin-left: 5px;
}

.skeleton-container {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.skeleton-card {
  background: #1e1e1e;
  border: 1px solid #333;
  border-radius: 10px;
  height: 150px;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% { background-color: #1e1e1e; }
  50% { background-color: #252525; }
  100% { background-color: #1e1e1e; }
}

.filter-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.filter-modal {
  background: #1e1e1e;
  padding: 20px;
  border-radius: 10px;
  width: 90%;
  max-width: 400px;
  max-height: 80vh;
  overflow-y: auto;
}

.filter-section {
  margin-bottom: 20px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  margin: 10px 0;
  color: #fff;
}

.checkbox-label input {
  margin-right: 10px;
}

.apply-btn {
  background: #97f492;
  border: none;
  padding: 10px;
  border-radius: 20px;
  color: #121212;
  cursor: pointer;
  width: 100%;
}

.admin-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal {
  background: #1e1e1e;
  padding: 20px;
  border-radius: 10px;
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  overflow-y: auto;
  position: relative;
}

.admin-selection-modal {
  max-width: 300px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.modal-header h2 {
  margin: 0;
  font-size: 18px;
}

.close-btn {
  background: none;
  border: none;
  color: #fff;
  font-size: 24px;
  cursor: pointer;
}

.selection-buttons {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.selection-btn {
  background: #97f492;
  border: none;
  padding: 10px;
  border-radius: 20px;
  color: #121212;
  cursor: pointer;
  font-size: 14px;
}

.job-details {
  color: #fff;
}

.job-details input,
.job-details textarea {
  width: 100%;
  padding: 10px;
  margin-bottom: 10px;
  border: 1px solid #333;
  border-radius: 5px;
  background: #252525;
  color: #fff;
}

.requirements {
  list-style: none;
  padding: 0;
  margin-bottom: 10px;
}

.requirements li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5px 0;
}

.delete-req,
.delete-tag {
  background: #ff5555;
  border: none;
  color: #fff;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  cursor: pointer;
}

.contact-btn {
  background: #97f492;
  border: none;
  padding: 10px;
  border-radius: 20px;
  color: #121212;
  cursor: pointer;
  width: 100%;
  text-align: center;
  text-decoration: none;
  display: block;
  margin-top: 10px;
}

.user-info {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
  justify-content: space-between;
}

.company-link {
  display: flex;
  align-items: center;
  text-decoration: none;
  color: #fff;
}

.nickname {
  font-size: 16px;
  font-weight: bold;
  margin: 0;
}

.section {
  margin-bottom: 20px;
}

.section h3 {
  margin: 0 0 10px 0;
  font-size: 16px;
}

.description {
  font-size: 14px;
  color: #ccc;
  margin: 0;
}

.favorite-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #888;
}

.favorite-btn .favorite {
  color: #ff5555;
}

.pin-section {
  margin-top: 20px;
}

.pin-section label {
  display: flex;
  align-items: center;
  color: #fff;
}

.pin-section input {
  margin-right: 10px;
}

.delete-btn {
  background: #ff5555;
  border: none;
  padding: 10px;
  border-radius: 20px;
  color: #fff;
  cursor: pointer;
  width: 100%;
  margin-top: 10px;
}

.selected-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-bottom: 15px;
}

.filter-pill {
  background: #333;
  padding: 5px 10px;
  border-radius: 15px;
  font-size: 12px;
  color: #fff;
  display: flex;
  align-items: center;
}

.filter-pill button {
  background: none;
  border: none;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  margin-left: 5px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.3s, opacity 0.3s;
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>