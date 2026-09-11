        const { ipcRenderer } = require('electron');
        const fs = require('fs');
        const path = require('path');
        const os = require('os');
        const APP_DIR = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'DrinkWaterApp');
        if (!fs.existsSync(APP_DIR)) fs.mkdirSync(APP_DIR, { recursive: true });
        const TRACKING_FILE_PATH = path.join(APP_DIR, 'tracking_data.jsonl');
        const CONFIG_FILE_PATH = path.join(APP_DIR, 'config.json');

        let appConfig = {
            tabPositionX: 0,
            lunar: { enabled: true, userName: "Gia Chủ", birthDate: "1993-04-10" },
            water: { enabled: true, times: ["08:30", "09:30", "10:30", "14:00", "15:00", "16:00", "17:00"] },
            pill: { enabled: true, items: [{ time: "09:00", name: "Vitamin C" }, { time: "14:00", name: "Kẽm" }] }
        };

        function loadConfig() {
            try {
                if (fs.existsSync(CONFIG_FILE_PATH)) {
                    appConfig = JSON.parse(fs.readFileSync(CONFIG_FILE_PATH, 'utf8'));
                } else {
                    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(appConfig, null, 4), 'utf8');
                }
            } catch (e) {
                console.error('Lỗi đọc config', e);
            }
            applyConfigToUI();
        }

        function applyConfigToUI() {
            const bar = document.getElementById('bar');
            const waterContainer = document.getElementById('water-container');
            const pillContainer = document.getElementById('pill-container');
            
            bar.style.display = appConfig.lunar.enabled ? 'flex' : 'none';
            waterContainer.style.display = (appConfig.water && appConfig.water.enabled) ? 'flex' : 'none';
            pillContainer.style.display = (appConfig.pill && appConfig.pill.enabled) ? 'flex' : 'none';
            
            renderWaterBottle();
            renderPillBottle();
            updateFengShuiData();
            renderWeight();
            renderReminders();
        }

        function isTodayInSchedule(repeatType, repeatValue) {
            const now = new Date();
            if (repeatType === 'daily' || repeatType === 'hourly') return true;
            if (repeatType === 'weekly') {
                const day = now.getDay();
                const jsDay = day === 0 ? 8 : day + 1; // 2=Monday, 8=Sunday
                return parseInt(repeatValue) === jsDay;
            }
            if (repeatType === 'monthly') {
                return parseInt(repeatValue) === now.getDate();
            }
            if (repeatType === 'yearly') {
                const parts = (repeatValue || "").split('-'); // MM-DD
                if (parts.length === 2) {
                    return parseInt(parts[0]) === (now.getMonth() + 1) && parseInt(parts[1]) === now.getDate();
                }
            }
            return false;
        }

        function renderWeight() {
            const wrapper = document.getElementById('weight-wrapper');
            if (!appConfig.weight || !appConfig.weight.enabled) {
                wrapper.style.display = 'none';
                return;
            }
            if (!isTodayInSchedule(appConfig.weight.repeatType, appConfig.weight.repeatValue)) {
                wrapper.style.display = 'none';
                return;
            }
            
            const now = new Date();
            const todayStr = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate();
            const dataArray = getTrackingData();
            const todayData = dataArray.find(d => d.date === todayStr);
            if (todayData && todayData.weight && todayData.weight.value) {
                wrapper.style.display = 'none';
                return;
            }

            wrapper.style.display = 'flex';
            
            const icon = document.getElementById('weight-icon');
            const input = document.getElementById('weight-input');
            
            icon.onclick = () => {
                wrapper.classList.add('expanded');
                input.focus();
            };
            
            input.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    const val = parseFloat(input.value);
                    if (val > 0) {
                        saveWeight(val);
                        wrapper.style.display = 'none';
                        wrapper.classList.remove('expanded');
                    }
                }
            };
        }

        function saveWeight(val) {
            const now = new Date();
            const todayStr = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate();
            const dataArray = getTrackingData();
            let todayData = dataArray.find(d => d.date === todayStr);
            if (!todayData) {
                todayData = { date: todayStr };
                dataArray.push(todayData);
            }
            todayData.weight = { value: val };
            saveTrackingData(dataArray);
            ipcRenderer.send('data-updated');
        }

        function generateTodayReminderInstances() {
            if (!appConfig.reminder || !appConfig.reminder.enabled) return [];
            const items = appConfig.reminder.items || [];
            let instances = [];
            
            items.forEach((item, index) => {
                if (!isTodayInSchedule(item.repeatType, item.repeatValue)) return;
                
                if (item.repeatType === 'hourly') {
                    const [h, m] = item.time.split(':').map(Number);
                    const startMin = h * 60 + m;
                    const interval = parseFloat(item.repeatValue) || 1;
                    const intervalMin = Math.round(interval * 60);
                    
                    for (let cur = startMin; cur < 24 * 60; cur += intervalMin) {
                        const curH = Math.floor(cur / 60).toString().padStart(2, '0');
                        const curM = (cur % 60).toString().padStart(2, '0');
                        instances.push({
                            id: `${index}-${curH}:${curM}`,
                            time: `${curH}:${curM}`,
                            name: item.name,
                            totalMin: cur
                        });
                    }
                } else {
                    const [h, m] = item.time.split(':').map(Number);
                    instances.push({
                        id: `${index}-${item.time}`,
                        time: item.time,
                        name: item.name,
                        totalMin: h * 60 + m
                    });
                }
            });
            instances.sort((a,b) => a.totalMin - b.totalMin);
            return instances;
        }

        function renderReminders() {
            const container = document.getElementById('reminder-container');
            if (!container) return;
            container.innerHTML = '';
            
            const instances = generateTodayReminderInstances();
            if (instances.length === 0) return;
            
            const now = new Date();
            const currentTotalMin = now.getHours() * 60 + now.getMinutes();
            const todayStr = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate();
            const dataArray = getTrackingData();
            const todayData = dataArray.find(d => d.date === todayStr);
            const stateMap = (todayData && todayData.reminder && todayData.reminder.stateMap) ? todayData.reminder.stateMap : {};
            
            let displayCount = 0;
            instances.forEach(inst => {
                if (stateMap[inst.id]) return;
                
                if (currentTotalMin >= inst.totalMin && displayCount < 3) {
                    const el = document.createElement('div');
                    el.className = 'reminder-item';
                    el.innerHTML = `
                        <div class="reminder-check"></div>
                        <div class="reminder-time">${inst.time}</div>
                        <div class="reminder-note" title="${inst.name}">${inst.name}</div>
                    `;
                    el.onclick = () => {
                        el.classList.add('fade-out');
                        setTimeout(() => el.remove(), 300);
                        toggleReminder(inst.id);
                    };
                    container.appendChild(el);
                    displayCount++;
                }
            });
        }

        function toggleReminder(id) {
            const now = new Date();
            const todayStr = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate();
            const dataArray = getTrackingData();
            let todayData = dataArray.find(d => d.date === todayStr);
            if (!todayData) {
                todayData = { date: todayStr };
                dataArray.push(todayData);
            }
            if (!todayData.reminder) todayData.reminder = { stateMap: {} };
            
            todayData.reminder.stateMap[id] = true;
            saveTrackingData(dataArray);
            ipcRenderer.send('data-updated');
        }

        // Settings Button
        document.getElementById('btn-settings').addEventListener('click', () => {
            ipcRenderer.send('open-settings');
        });

        ipcRenderer.on('config-updated', () => {
            loadConfig();
        });

        ipcRenderer.on('preview-config', (event, tempConfig) => {
            appConfig = tempConfig;
            applyConfigToUI();
        });

        // Hover popup logic
        const barEl = document.getElementById('bar');
        const popupEl = document.getElementById('popup');
        let hoverTimeout;
        
        function showPopup() {
            clearTimeout(hoverTimeout);
            ipcRenderer.send('expand-window');
            popupEl.classList.add('show');
        }
        
        function hidePopup() {
            hoverTimeout = setTimeout(() => {
                popupEl.classList.remove('show');
                ipcRenderer.send('collapse-window');
            }, 100);
        }
        
        barEl.addEventListener('mouseenter', showPopup);
        barEl.addEventListener('mouseleave', hidePopup);
        popupEl.addEventListener('mouseenter', showPopup);
        popupEl.addEventListener('mouseleave', hidePopup);

        function getTrackingData() {
            try {
                if (fs.existsSync(TRACKING_FILE_PATH)) {
                    const content = fs.readFileSync(TRACKING_FILE_PATH, 'utf8').trim();
                    if (content) {
                        return content.split('\n').map(line => {
                            try { return JSON.parse(line); } catch(e) { return null; }
                        }).filter(Boolean);
                    }
                }
            } catch (e) {}
            return [];
        }

        function saveTrackingData(dataArray) {
            try {
                const content = dataArray.map(item => JSON.stringify(item)).join('\n');
                fs.writeFileSync(TRACKING_FILE_PATH, content + '\n', 'utf8');
            } catch (e) {}
        }

        // =========================================================================
        // DATA MAPS FOR FENG SHUI
        // =========================================================================
        const DIRECTION_MAP = {
            '乾': 'Tây Bắc', '坤': 'Tây Nam', '艮': 'Đông Bắc', '巽': 'Đông Nam',
            '震': 'Chính Đông', '离': 'Chính Nam', '兑': 'Chính Tây', '坎': 'Chính Bắc',
            '正东': 'Chính Đông', '正南': 'Chính Nam', '正西': 'Chính Tây', '正北': 'Chính Bắc',
            '东北': 'Đông Bắc', '东南': 'Đông Nam', '西北': 'Tây Bắc', '西南': 'Tây Nam'
        };

        const ANIMAL_MAP = {
            '鼠': 'Tý (Chuột)', '牛': 'Sửu (Trâu)', '虎': 'Dần (Hổ)', '兔': 'Mão (Mèo)',
            '龙': 'Thìn (Rồng)', '蛇': 'Tỵ (Rắn)', '马': 'Ngọ (Ngựa)', '羊': 'Mùi (Dê)',
            '猴': 'Thân (Khỉ)', '鸡': 'Dậu (Gà)', '狗': 'Tuất (Chó)', '猪': 'Hợi (Lợn)'
        };

        const TIAN_GAN_MAP = {
            '甲': 'Giáp', '乙': 'Ất', '丙': 'Bính', '丁': 'Đinh', '戊': 'Mậu',
            '己': 'Kỷ', '庚': 'Canh', '辛': 'Tân', '壬': 'Nhâm', '癸': 'Quý'
        };

        const DI_CHI_MAP = {
            '子': 'Tý', '丑': 'Sửu', '寅': 'Dần', '卯': 'Mão', '辰': 'Thìn', '巳': 'Tỵ',
            '午': 'Ngọ', '未': 'Mùi', '申': 'Thân', '酉': 'Dậu', '戌': 'Tuất', '亥': 'Hợi'
        };

        const ALL_CHAR_MAP = {
            '甲': 'Giáp ', '乙': 'Ất ', '丙': 'Bính ', '丁': 'Đinh ', '戊': 'Mậu ',
            '己': 'Kỷ ', '庚': 'Canh ', '辛': 'Tân ', '壬': 'Nhâm ', '癸': 'Quý ',
            '子': 'Tý', '丑': 'Sửu', '寅': 'Dần', '卯': 'Mão', '辰': 'Thìn', '巳': 'Tỵ',
            '午': 'Ngọ', '未': 'Mùi', '申': 'Thân', '酉': 'Dậu', '戌': 'Tuất', '亥': 'Hợi',
            '鼠': 'Chuột', '牛': 'Trâu', '虎': 'Hổ', '兔': 'Mèo', '龙': 'Rồng', '蛇': 'Rắn',
            '马': 'Ngựa', '羊': 'Dê', '猴': 'Khỉ', '鸡': 'Gà', '狗': 'Chó', '猪': 'Lợn',
            '黄道': 'Hoàng Đạo', '黑道': 'Hắc Đạo', '吉': 'Cát', '凶': 'Hung'
        };

        const NA_YIN_MAP = {
            '海中金': { name: 'Hải Trung Kim', element: 'Kim' },
            '炉中火': { name: 'Lô Trung Hỏa', element: 'Hỏa' },
            '大林木': { name: 'Đại Lâm Mộc', element: 'Mộc' },
            '路旁土': { name: 'Lộ Bàng Thổ', element: 'Thổ' },
            '剑锋金': { name: 'Kiếm Phong Kim', element: 'Kim' },
            '山头火': { name: 'Sơn Đầu Hỏa', element: 'Hỏa' },
            '涧下水': { name: 'Giản Hạ Thủy', element: 'Thủy' },
            '城头土': { name: 'Thành Đầu Thổ', element: 'Thổ' },
            '白蜡金': { name: 'Bạch Lạp Kim', element: 'Kim' },
            '杨柳木': { name: 'Dương Liễu Mộc', element: 'Mộc' },
            '泉中水': { name: 'Tuyền Trung Thủy', element: 'Thủy' },
            '屋上土': { name: 'Ốc Thượng Thổ', element: 'Thổ' },
            '霹雳火': { name: 'Tích Lịch Hỏa', element: 'Hỏa' },
            '松柏木': { name: 'Tùng Bách Mộc', element: 'Mộc' },
            '长流水': { name: 'Trường Lưu Thủy', element: 'Thủy' },
            '沙中金': { name: 'Sa Trung Kim', element: 'Kim' },
            '山下火': { name: 'Sơn Hạ Hỏa', element: 'Hỏa' },
            '平地木': { name: 'Bình Địa Mộc', element: 'Mộc' },
            '壁上土': { name: 'Bích Thượng Thổ', element: 'Thổ' },
            '金箔金': { name: 'Kim Bạch Kim', element: 'Kim' },
            '佛灯火': { name: 'Phúc Đăng Hỏa', element: 'Hỏa' },
            '天河水': { name: 'Thiên Hà Thủy', element: 'Thủy' },
            '大驿土': { name: 'Đại Trạch Thổ', element: 'Thổ' },
            '钗钏金': { name: 'Thoa Xuyến Kim', element: 'Kim' },
            '桑柘木': { name: 'Tang Đố Mộc', element: 'Mộc' },
            '大溪水': { name: 'Đại Khê Thủy', element: 'Thủy' },
            '沙中土': { name: 'Sa Trung Thổ', element: 'Thổ' },
            '天上火': { name: 'Thiên Thượng Hỏa', element: 'Hỏa' },
            '石榴木': { name: 'Thạch Lựu Mộc', element: 'Mộc' },
            '大海水': { name: 'Đại Hải Thủy', element: 'Thủy' }
        };

        function cleanChineseText(str) {
            if (!str) return '';
            let res = str;
            for (let [cn, vn] of Object.entries(ALL_CHAR_MAP)) {
                res = res.replaceAll(cn, vn);
            }
            return res.trim();
        }

        const LIUYAO_EXPLANATION = {
            '大安': 'Đại An: Mọi việc bình an, hanh thông, đi xa tốt lành.',
            '留连': 'Lưu Niên: Công việc mưu sự dễ trì hoãn, nên kiên nhẫn.',
            '速喜': 'Tốc Hỷ: Tin vui & may mắn đến nhanh, thích hợp cầu tài.',
            '赤口': 'Xích Khẩu: Đề phòng mâu thuẫn, cãi vã, va chạm.',
            '小吉': 'Tiểu Cát: Có quý nhân phù trợ, mọi việc thuận lợi.',
            '空亡': 'Không Vong: Vận khí trầm, nên tránh khởi công việc lớn.',
            '先胜': 'Tiên Thắng: Buổi sáng may mắn cát lành, buổi chiều nên tĩnh.',
            '先负': 'Tiên Phụ: Buổi sáng bất lợi, từ sau 12h trưa hanh thông.'
        };

        const SHEN_EXPLANATION = {
            '青龙': 'Thanh Long (Hoàng Đạo): Cát lành nhất, trăm việc đều thuận.',
            '明堂': 'Minh Đường (Hoàng Đạo): Quý nhân phù trợ, thăng tiến công danh.',
            '天刑': 'Thiên Hình (Hắc Đạo): Đề phòng tranh chấp, kiện tụng.',
            '朱雀': 'Chu Tước (Hắc Đạo): Đề phòng thị phi, khẩu tài.',
            '金匮': 'Kim Quỹ (Hoàng Đạo): Tốt cho chốt hợp đồng, tích lũy tài lộc.',
            '天德': 'Thiên Đức (Hoàng Đạo): Đức trời ban, hóa giải mọi điều xấu.',
            '白虎': 'Bạch Hổ (Hắc Đạo): Đề phòng tai ương, va chạm.',
            '玉堂': 'Ngọc Đường (Hoàng Đạo): Khai trương, học hành, thi cử tốt.',
            '天牢': 'Thiên Lao (Hắc Đạo): Dễ bị vướng mắc, đình trệ.',
            '玄武': 'Huyền Vũ (Hắc Đạo): Đề phòng trộm cắp, tổn thất.',
            '司命': 'Tư Mệnh (Hoàng Đạo): Mọi việc hành sự đều được độ trì.',
            '勾陈': 'Câu Trần (Hắc Đạo): Công việc chậm trễ, phát sinh phiền phức.'
        };

        function checkZhiRelation(dayZhi, birthZhi) {
            if (dayZhi === birthZhi) {
                const tuHinhList = ['酉', '辰', '午', '亥'];
                if (tuHinhList.includes(dayZhi)) {
                    return { type: 'BAD', name: 'Tự Hình', desc: 'Tự Hình (Nên giữ sức, kiềm chế nhẫn nại)' };
                }
                return { type: 'GOOD', name: 'Đồng Chi', desc: 'Trợ lực đồng khí' };
            }
            const lucHop = [['子', '丑'], ['寅', '亥'], ['卯', '戌'], ['辰', '酉'], ['巳', '申'], ['午', '未']];
            for (let pair of lucHop) {
                if ((pair[0] === dayZhi && pair[1] === birthZhi) || (pair[1] === dayZhi && pair[0] === birthZhi)) {
                    return { type: 'VERY_GOOD', name: 'Lục Hợp', desc: 'Lục Hợp cát lành (Quý nhân trợ lực)' };
                }
            }
            const tamHop = [['申', '子', '辰'], ['寅', '午', '戌'], ['巳', '酉', '丑'], ['亥', '卯', '未']];
            for (let group of tamHop) {
                if (group.includes(dayZhi) && group.includes(birthZhi)) {
                    return { type: 'VERY_GOOD', name: 'Tam Hợp', desc: 'Tam Hợp hanh thông (Mưu sự dễ thành)' };
                }
            }
            const lucXung = [['子', '午'], ['丑', '未'], ['寅', '申'], ['卯', '酉'], ['辰', '戌'], ['巳', '亥']];
            for (let pair of lucXung) {
                if ((pair[0] === dayZhi && pair[1] === birthZhi) || (pair[1] === dayZhi && pair[0] === birthZhi)) {
                    return { type: 'BAD', name: 'Lục Xung', desc: 'Xung khắc tuổi gia chủ (Nên kiềm chế hòa nhã)' };
                }
            }
            return { type: 'NEUTRAL', name: 'Bình Hòa', desc: 'Địa chi bình hòa' };
        }

        function checkElementRelation(dayElem, birthElem) {
            if (!dayElem || !birthElem) return { type: 'NEUTRAL', text: 'Ngũ hành bình hòa' };
            if (dayElem === birthElem) return { type: 'GOOD', text: `Đồng hòa ${dayElem} (Trợ lực mạnh mẽ)` };

            const sinhMap = { 'Kim': 'Thủy', 'Thủy': 'Mộc', 'Mộc': 'Hỏa', 'Hỏa': 'Thổ', 'Thổ': 'Kim' };
            const khacMap = { 'Kim': 'Mộc', 'Mộc': 'Thổ', 'Thổ': 'Thủy', 'Thủy': 'Hỏa', 'Hỏa': 'Kim' };

            if (sinhMap[dayElem] === birthElem) return { type: 'VERY_GOOD', text: `Ngày ${dayElem} tương sinh Mệnh ${birthElem} (Vận khí cực tốt)` };
            if (sinhMap[birthElem] === dayElem) return { type: 'GOOD', text: `Mệnh ${birthElem} sinh Ngày ${dayElem} (Xuất lực, thuận lợi)` };
            if (khacMap[dayElem] === birthElem) return { type: 'BAD', text: `Ngày ${dayElem} khắc Mệnh ${birthElem} (Nên tĩnh, giữ sức)` };
            if (khacMap[birthElem] === dayElem) return { type: 'NEUTRAL', text: `Mệnh ${birthElem} khắc Ngày ${dayElem} (Làm chủ tình thế)` };
            return { type: 'NEUTRAL', text: 'Ngũ hành bình hòa' };
        }

        function updateFengShuiData() {
            if (!appConfig.lunar.enabled) return;
            try {
                const { Lunar, Solar } = require('./lunar.js');
                const now = new Date();
                const lunar = Lunar.fromDate(now);

                const day = lunar.getDay();
                const month = lunar.getMonth();
                const year = lunar.getYear();
                const canChiDayVn = cleanChineseText(lunar.getDayInGanZhi());

                const barDateEl = document.getElementById('bar-date');
                const barStatusEl = document.getElementById('bar-status');
                barDateEl.innerText = `Âm Lịch: ${day}/${month}/${year} (${canChiDayVn})`;

                const overlayBarEl = document.getElementById('bar');
                let specialDayPrefix = '';
                if (day === 1) {
                    specialDayPrefix = '🌟 Mùng 1 - ';
                    overlayBarEl.classList.add('is-special-day');
                } else if (day === 15) {
                    specialDayPrefix = '🌕 Ngày Rằm - ';
                    overlayBarEl.classList.add('is-special-day');
                } else {
                    overlayBarEl.classList.remove('is-special-day');
                }

                const dayTianShenType = lunar.getDayTianShenType();
                const isGoodDay = (dayTianShenType === '黄道');
                const popDayStatusEl = document.getElementById('pop-day-status');
                if (popDayStatusEl) {
                    if (isGoodDay) {
                        popDayStatusEl.className = 'section-desc good';
                        popDayStatusEl.innerText = 'Ngày Hoàng Đạo (Cát Lành) - Thích hợp mưu sự, khởi công, việc lớn.';
                    } else {
                        popDayStatusEl.className = 'section-desc bad';
                        popDayStatusEl.innerText = 'Ngày Hắc Đạo (Hung) - Nên cẩn thận, hạn chế khởi công việc lớn.';
                    }
                }

                if (appConfig.lunar.birthDate) {
                    const [bY, bM, bD] = appConfig.lunar.birthDate.split('-').map(Number);
                    const birthSolar = Solar.fromYmd(bY, bM, bD);
                    const birthLunar = birthSolar.getLunar();

                    const dayZhi = lunar.getDayZhi();
                    const birthZhi = birthLunar.getYearZhi();
                    const zhiRel = checkZhiRelation(dayZhi, birthZhi);

                    const dayNaYinRaw = lunar.getDayNaYin();
                    const dayNaYinInfo = NA_YIN_MAP[dayNaYinRaw] || { name: cleanChineseText(dayNaYinRaw), element: 'Khác' };
                    const birthNaYinRaw = birthLunar.getYearNaYin();
                    const birthNaYinInfo = NA_YIN_MAP[birthNaYinRaw] || { name: cleanChineseText(birthNaYinRaw), element: 'Khác' };
                    const elemRel = checkElementRelation(dayNaYinInfo.element, birthNaYinInfo.element);

                    const popPersonalEvalEl = document.getElementById('pop-personal-eval');
                    
                    const userTitle = appConfig.lunar.userName || "Gia Chủ";
                    document.querySelector('.popup-section .section-label').innerText = `👤 Vận Hạn Hôm Nay (${userTitle}):`;

                    let barStatusText = '';
                    let barStatusClass = 'bar-status';
                    let detailEvalClass = 'section-desc';
                    let detailEvalText = '';

                    if (zhiRel.type === 'VERY_GOOD' && elemRel.type === 'VERY_GOOD') {
                        barStatusClass = 'bar-status status-good';
                        barStatusText = `${specialDayPrefix}🌟 Rất Hợp Tuổi (Cát Khánh)`;
                        detailEvalClass = 'section-desc good';
                        detailEvalText = '🌟 RẤT HỢP TUỔI & TƯƠNG SINH - Cát lành, vận khí cực tốt, mưu sự dễ thành!';
                    } else if (zhiRel.type === 'VERY_GOOD') {
                        barStatusClass = 'bar-status status-good';
                        barStatusText = `${specialDayPrefix}🌟 Hợp Tuổi (${zhiRel.name})`;
                        detailEvalClass = 'section-desc good';
                        detailEvalText = `🌟 HỢP TUỔI (${zhiRel.name}) - Ngày tốt, quý nhân trợ lực, mưu sự hanh thông.`;
                    } else if (elemRel.type === 'VERY_GOOD') {
                        barStatusClass = 'bar-status status-good';
                        barStatusText = `${specialDayPrefix}🌟 Ngũ Hành Tương Sinh`;
                        detailEvalClass = 'section-desc good';
                        detailEvalText = '🌟 NGŨ HÀNH TƯƠNG SINH - Vận trình thuận lợi, công việc suôn sẻ.';
                    } else if (zhiRel.type === 'BAD' || elemRel.type === 'BAD') {
                        barStatusClass = 'bar-status status-bad';
                        const reason = zhiRel.type === 'BAD' ? 'Xung Tuổi' : 'Tương Khắc';
                        barStatusText = `${specialDayPrefix}⚠️ ${reason} (Cẩn Trọng)`;
                        detailEvalClass = 'section-desc bad';
                        detailEvalText = `⚠️ KHÔNG HỢP (${reason}) - Vận khí trầm, nên giữ sức, tránh tranh cãi.`;
                    } else if (zhiRel.type === 'GOOD' || elemRel.type === 'GOOD') {
                        barStatusClass = 'bar-status status-good';
                        barStatusText = `${specialDayPrefix}✨ Hợp Tuổi (Khá Tốt)`;
                        detailEvalClass = 'section-desc gold';
                        detailEvalText = '✨ KHÁ TỐT (Có đồng khí trợ lực) - Mọi việc diễn ra suôn sẻ.';
                    } else {
                        barStatusClass = 'bar-status';
                        barStatusText = `${specialDayPrefix}☯️ Bình Hòa Tuổi`;
                        detailEvalClass = 'section-desc';
                        detailEvalText = '☯️ BÌNH HÒA - Không xung không hợp, mọi việc an ổn.';
                    }

                    barStatusEl.className = barStatusClass;
                    barStatusEl.innerText = barStatusText;

                    if (popPersonalEvalEl) {
                        popPersonalEvalEl.className = detailEvalClass;
                        popPersonalEvalEl.innerText = detailEvalText;
                    }
                }

                const liuYaoRaw = lunar.getLiuYao();
                const liuYaoDesc = LIUYAO_EXPLANATION[liuYaoRaw] || `Lục Diệu: ${cleanChineseText(liuYaoRaw)}`;
                const popLiuYaoEl = document.getElementById('pop-liuyao');
                popLiuYaoEl.innerText = liuYaoDesc;
                popLiuYaoEl.className = liuYaoRaw.includes('安') || liuYaoRaw.includes('喜') || liuYaoRaw.includes('吉') ? 'section-desc good' : 'section-desc';

                const currentHour = now.getHours();
                const timesArr = lunar.getTimes();
                let currentTianShenRaw = '';
                let isHuangDaoHour = true;
                let goodHoursList = [];

                timesArr.forEach(t => {
                    const minH = parseInt(t.getMinHm().split(':')[0]);
                    const maxH = parseInt(t.getMaxHm().split(':')[0]);
                    const isCurrent = (currentHour >= minH && currentHour <= maxH) || (minH > maxH && (currentHour >= minH || currentHour <= maxH));
                    const shenName = t.getTianShen();
                    const isHuangDao = (t.getTianShenType() === '黄道');

                    if (isCurrent) {
                        currentTianShenRaw = shenName;
                        isHuangDaoHour = isHuangDao;
                    }
                    if (isHuangDao) {
                        const gz = t.getGanZhi();
                        const hourChi = gz.length > 1 ? gz[1] : gz;
                        const hourChiVn = DI_CHI_MAP[hourChi] || cleanChineseText(hourChi);
                        goodHoursList.push(`${hourChiVn} (${t.getMinHm()})`);
                    }
                });

                const popHourEl = document.getElementById('pop-hour');
                const hourDesc = SHEN_EXPLANATION[currentTianShenRaw] || `Giờ ${cleanChineseText(currentTianShenRaw)}`;
                popHourEl.innerText = hourDesc;
                popHourEl.className = isHuangDaoHour ? 'section-desc good' : 'section-desc bad';

                const caiDir = DIRECTION_MAP[lunar.getDayPositionCaiDesc()] || cleanChineseText(lunar.getDayPositionCaiDesc());
                const xiDir = DIRECTION_MAP[lunar.getDayPositionXiDesc()] || cleanChineseText(lunar.getDayPositionXiDesc());
                const fuDir = DIRECTION_MAP[lunar.getDayPositionFuDesc()] || cleanChineseText(lunar.getDayPositionFuDesc());
                document.getElementById('pop-direction').innerText = `Tài Thần: ${caiDir} | Hỷ Thần: ${xiDir} | Phúc Thần: ${fuDir}`;

                const chongGanVn = TIAN_GAN_MAP[lunar.getDayChongGan()] || cleanChineseText(lunar.getDayChongGan());
                const chongAnimalVn = ANIMAL_MAP[lunar.getDayChongShengXiao()] || cleanChineseText(lunar.getDayChongShengXiao());
                document.getElementById('pop-chong').innerText = `Tuổi xung trong ngày: ${chongGanVn} ${chongAnimalVn} (Nên cẩn trọng hòa nhã)`;

                document.getElementById('pop-good-hours').innerText = goodHoursList.length > 0 ? goodHoursList.join(' • ') : 'Không có';

            } catch (err) {
                const barStatusEl = document.getElementById('bar-status');
                if (barStatusEl) {
                    barStatusEl.className = 'bar-status status-bad';
                    barStatusEl.innerText = 'Lỗi: ' + err.message;
                }
            }
        }

        function renderWaterBottle() {
            if (!appConfig.water.enabled) return;
            const container = document.getElementById('water-body');
            container.innerHTML = '';
            
            const times = appConfig.water.times || [];
            if (times.length === 0) return;
            
            const bottleWidth = Math.max(60, Math.min(150, times.length * 15));
            container.style.width = bottleWidth + 'px';
            
            times.forEach((timeStr, index) => {
                const seg = document.createElement('div');
                seg.className = 'water-segment';
                seg.title = `Đến ${timeStr}`;
                seg.dataset.index = index;
                seg.innerHTML = `<span>${timeStr}</span>`;
                
                seg.addEventListener('click', (e) => {
                    e.stopPropagation();
                    toggleWater(index);
                });
                
                container.appendChild(seg);
            });
            checkWaterStatus();
        }

        function toggleWater(index) {
            const now = new Date();
            const todayStr = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate();
            const dataArray = getTrackingData();
            let todayData = dataArray.find(d => d.date === todayStr);
            if (!todayData) {
                todayData = { date: todayStr, water: { state: [], times: [] }, pill: { state: [], items: [] } };
                dataArray.push(todayData);
            }
            if (!todayData.water) todayData.water = { state: [], times: [] };
            
            const times = appConfig.water.times || [];
            let waterState = Array.isArray(todayData.water.state) ? todayData.water.state : [];
            while (waterState.length < times.length) waterState.push(false);
            
            waterState[index] = !waterState[index];
            
            todayData.water.state = waterState;
            todayData.water.times = times;
            
            saveTrackingData(dataArray);
            checkWaterStatus();
            ipcRenderer.send('data-updated');
        }

        function checkWaterStatus() {
            const now = new Date();
            const currentTotalMin = now.getHours() * 60 + now.getMinutes();
            const todayStr = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate();
            const dataArray = getTrackingData();
            const todayData = dataArray.find(d => d.date === todayStr);
            const times = appConfig.water.times || [];
            let waterState = [];

            if (todayData && todayData.water && Array.isArray(todayData.water.state)) {
                waterState = todayData.water.state;
            }
            while (waterState.length < times.length) waterState.push(false);

            const segments = document.querySelectorAll('.water-segment');
            segments.forEach((seg, index) => {
                if (index >= times.length) return;
                const timeStr = times[index];
                const [h, m] = timeStr.split(':').map(Number);
                const deadlineTotalMin = h * 60 + m;

                seg.classList.remove('drank', 'missed', 'ignored');
                if (waterState[index]) {
                    seg.classList.add('drank');
                } else if (currentTotalMin >= deadlineTotalMin) {
                    if (currentTotalMin - deadlineTotalMin > 10) {
                        seg.classList.add('ignored');
                    } else {
                        seg.classList.add('missed');
                    }
                }
            });
        }

        function renderPillBottle() {
            if (!appConfig.pill.enabled) return;
            const container = document.getElementById('pill-body');
            container.innerHTML = '';
            
            const items = appConfig.pill.items || [];
            if (items.length === 0) return;
            
            items.forEach((item, index) => {
                const pocket = document.createElement('div');
                pocket.className = 'blister-pocket';
                pocket.title = `${item.time} - ${item.name}`;
                
                const pill = document.createElement('div');
                pill.className = 'pill-item';
                pill.title = `${item.time} - ${item.name}`;
                pill.dataset.index = index;
                pill.innerHTML = `<span>${item.time}</span>`;
                
                const clickHandler = (e) => {
                    e.stopPropagation();
                    togglePill(index);
                };
                
                pill.addEventListener('click', clickHandler);
                pocket.addEventListener('click', (e) => {
                    if (e.target === pocket) clickHandler(e);
                });
                
                pocket.appendChild(pill);
                container.appendChild(pocket);
                
                if (index < items.length - 1) {
                    const divider = document.createElement('div');
                    divider.className = 'blister-divider';
                    container.appendChild(divider);
                }
            });
            checkPillStatus();
        }

        function togglePill(index) {
            const now = new Date();
            const todayStr = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate();
            const dataArray = getTrackingData();
            let todayData = dataArray.find(d => d.date === todayStr);
            if (!todayData) {
                todayData = { date: todayStr, water: { state: [], times: [] }, pill: { state: [], items: [] } };
                dataArray.push(todayData);
            }
            if (!todayData.pill) todayData.pill = { state: [], items: [] };
            
            const items = appConfig.pill.items || [];
            let pillState = Array.isArray(todayData.pill.state) ? todayData.pill.state : [];
            while (pillState.length < items.length) pillState.push(false);
            
            pillState[index] = !pillState[index];
            
            todayData.pill.state = pillState;
            todayData.pill.items = items;
            
            saveTrackingData(dataArray);
            checkPillStatus();
            ipcRenderer.send('data-updated');
        }

        function checkPillStatus() {
            const now = new Date();
            const currentTotalMin = now.getHours() * 60 + now.getMinutes();
            const todayStr = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate();
            const dataArray = getTrackingData();
            const todayData = dataArray.find(d => d.date === todayStr);
            const items = appConfig.pill.items || [];
            
            let pillState = [];
            if (todayData && todayData.pill && Array.isArray(todayData.pill.state)) {
                pillState = todayData.pill.state;
            }
            while (pillState.length < items.length) pillState.push(false);

            const segments = document.querySelectorAll('.pill-item');
            segments.forEach((seg, index) => {
                if (index >= items.length) return;
                const item = items[index];
                const [h, m] = item.time.split(':').map(Number);
                const deadlineTotalMin = h * 60 + m;
                
                seg.classList.remove('taken', 'missed');
                if (pillState[index]) {
                    seg.classList.add('taken');
                } else if (currentTotalMin >= deadlineTotalMin) {
                    seg.classList.add('missed');
                }
            });
        }

        // Initialize
        loadConfig();
        setInterval(() => {
            updateFengShuiData();
            checkWaterStatus();
            checkPillStatus();
            renderReminders();
        }, 60000);

        // Dynamically update window width when content size changes
        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                let w = entry.target.scrollWidth;
                if (w < 480) w = 480;
                ipcRenderer.send('update-width', w);
            }
        });
        
        window.addEventListener('DOMContentLoaded', () => {
            const wrapper = document.getElementById('wrapper');
            if (wrapper) resizeObserver.observe(wrapper);
        });
        
        // Also observe immediately in case DOM is already loaded
        const wrapperEl = document.getElementById('wrapper');
        if (wrapperEl) resizeObserver.observe(wrapperEl);
