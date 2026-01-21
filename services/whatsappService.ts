
import { getTrainingById, getResponses, getSettings, saveTraining } from './storageService';

// Helper untuk format tanggal Indonesia
const formatDateID = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

// Helper untuk label nilai
const getScoreLabel = (val: number, type: 'star' | 'slider') => {
    if (type === 'star') {
        if (val >= 4.2) return 'Sangat Baik';
        if (val >= 3.4) return 'Baik';
        if (val >= 2.6) return 'Cukup';
        if (val >= 1.8) return 'Sedang';
        return 'Kurang';
    } else {
        // Slider Scale: 45-100 with breakpoints 55, 75, 85
        if (val >= 86) return 'Sangat Baik';
        if (val >= 76) return 'Baik';
        if (val >= 56) return 'Sedang';
        return 'Kurang';
    }
};

export const checkAndSendAutoReport = async (trainingId: string, targetId: string, targetName: string, type: 'facilitator' | 'process' = 'facilitator') => {
    const training = await getTrainingById(trainingId);
    if (!training) return;

    // --- LOGIC FOR FACILITATOR REPORT ---
    if (type === 'facilitator') {
        if (!training.targets || training.targets.length === 0) return;
        
        // Find the specific session/facilitator row using unique targetId
        // Note: targetId corresponds to the UUID of the specific session row in CreateTraining
        const facilitator = training.facilitators.find(f => f.id === targetId);
        
        if (!facilitator || !facilitator.whatsapp) {
            console.log("AutoReport: Facilitator/Session not found or no WhatsApp number.");
            return;
        }

        const allResponses = await getResponses(trainingId);
        
        // CRITICAL UPDATE: Filter responses by Name AND Subject to ensure multi-subject facilitators
        // have independent counters/triggers for each subject.
        const facResponses = allResponses.filter(r => 
            r.type === 'facilitator' && 
            r.targetName === facilitator.name &&
            r.targetSubject === facilitator.subject 
        );

        const count = facResponses.length;
        console.log(`AutoReport Check [${facilitator.name} - ${facilitator.subject}]: Count ${count}, Targets: ${training.targets.join(', ')}`);

        if (training.targets.includes(count)) {
            // Unique Report Key combines Session ID (targetId) and Count.
            // Since targetId is unique per session/materi, this separates reports correctly.
            const reportKey = `${targetId}_${count}`;
            
            if (!training.reportedTargets) training.reportedTargets = {};
            if (training.reportedTargets[reportKey]) return; // Already sent

            // Prepare Message
            const settings = await getSettings();
            const stats = calculateStats(facResponses, training.facilitatorQuestions);
            const overall = calculateOverallStats(facResponses, training.facilitatorQuestions);
            
            let message = `*${settings.waHeader}*\n`;
            message += `--------------------------\n`;
            message += `Yth. ${facilitator.name}\n`;
            message += `Pelatihan: ${training.title}\n`;
            message += `Materi: ${facilitator.subject}\n`;
            message += `Hari/Tgl: ${formatDateID(facilitator.sessionDate)}\n`;
            message += `Jumlah Responden: ${count} orang\n\n`;
            
            message += `*Ringkasan Nilai:*\n`;
            stats.forEach(s => {
                if (s.value !== 'Isian Teks') {
                    message += `- ${s.label}: *${s.value}*\n`;
                }
            });

            // --- NEW: Add Comment Snippets ---
            const textQuestions = training.facilitatorQuestions.filter(q => q.type === 'text');
            let allComments: string[] = [];
            textQuestions.forEach(q => {
                const answers = facResponses
                    .map(r => r.answers[q.id])
                    .filter(a => typeof a === 'string' && a.trim() !== '') as string[];
                allComments = [...allComments, ...answers];
            });

            // Sort by length (shortest first) and take top 2
            const shortSnippets = allComments.sort((a, b) => a.length - b.length).slice(0, 2);

            if (shortSnippets.length > 0) {
                // Format: "Pesan 1", "Pesan 2"
                const joinedSnippets = shortSnippets.map(s => `"${s}"`).join(', ');
                message += `\n*Cuplikan Pesan Peserta :*\n${joinedSnippets}\n`;
            }
            // ---------------------------------

            message += `\n*Rata-rata Keseluruhan:*\n`;
            if (overall.hasStar) {
                const label = getScoreLabel(overall.starAvg, 'star');
                message += `⭐ Bintang: *${overall.starAvg}/5.0 (${label})*\n`;
            }
            if (overall.hasSlider) {
                const label = getScoreLabel(overall.sliderAvg, 'slider');
                // Remove /100 suffix
                message += `📊 Skala: *${overall.sliderAvg} (${label})*\n`;
            }

            const baseUrl = window.location.href.split('#')[0];
            const commentLink = `${baseUrl}#/comments/${trainingId}/${targetId}`;

            message += `\n\n📊 *Hasil Rekap & Pesan Responden:*\n`;
            message += `Lihat rekapitulasi nilai dan baca seluruh pesan secara real time dari responden untuk sesi ini melalui tautan berikut :\n${commentLink}`;
            message += `\n\n${settings.waFooter}`;

            // Send
            const success = await sendViaFonnte(settings, facilitator.whatsapp, message);
            if (success) {
                training.reportedTargets[reportKey] = true;
                await saveTraining(training);
                console.log(`AutoReport: SUCCESS sent to ${facilitator.name} for subject ${facilitator.subject}`);
            }
        }
    } 
    // --- LOGIC FOR PROCESS REPORT (UPDATED: MULTI TARGET) ---
    else if (type === 'process') {
        const pTargets = training.processTargets || (training.processTarget ? [training.processTarget] : []);
        
        if (pTargets.length === 0 || !training.processOrganizer || !training.processOrganizer.whatsapp) return;
        
        const allResponses = await getResponses(trainingId);
        const procResponses = allResponses.filter(r => r.type === 'process');
        const count = procResponses.length;

        console.log(`AutoReport Process Check: Count ${count}, Targets: ${pTargets.join(', ')}`);

        // Check if current count is one of the targets
        if (pTargets.includes(count)) {
            // Generate Unique Key for Process Report to prevent duplicate sending
            const reportKey = `PROCESS_GENERAL_${count}`;
            
            if (!training.reportedTargets) training.reportedTargets = {};
            if (training.reportedTargets[reportKey]) return; // Already sent for this count

            const settings = await getSettings();
            const stats = calculateStats(procResponses, training.processQuestions);
            const overall = calculateOverallStats(procResponses, training.processQuestions);

            let message = `*${settings.waHeader} - PENYELENGGARAAN*\n`;
            message += `--------------------------\n`;
            message += `Yth. ${training.processOrganizer.name}\n`;
            message += `Pelatihan: ${training.title}\n`;
            message += `Periode: ${formatDateID(training.startDate)} s.d ${formatDateID(training.endDate)}\n`;
            message += `Jumlah Responden: ${count} orang\n\n`;

            message += `*Ringkasan Evaluasi Penyelenggaraan:*\n`;
            stats.forEach(s => {
                if (s.value !== 'Isian Teks') {
                    message += `- ${s.label}: *${s.value}*\n`;
                }
            });

            message += `\n*Rata-rata Keseluruhan:*\n`;
            if (overall.hasStar) {
                const label = getScoreLabel(overall.starAvg, 'star');
                message += `⭐ Bintang: *${overall.starAvg}/5.0 (${label})*\n`;
            }
            if (overall.hasSlider) {
                const label = getScoreLabel(overall.sliderAvg, 'slider');
                // Remove /100 suffix
                message += `📊 Skala: *${overall.sliderAvg} (${label})*\n`;
            }
            
            message += `\n\n${settings.waFooter}`;

            const success = await sendViaFonnte(settings, training.processOrganizer.whatsapp, message);
            if (success) {
                training.reportedTargets[reportKey] = true;
                // Also mark legacy flag for safety, though deprecated
                training.processReported = true; 
                await saveTraining(training);
                console.log(`AutoReport: SUCCESS sent to Process Organizer ${training.processOrganizer.name} for target ${count}`);
            }
        }
    }
};

const sendViaFonnte = async (settings: any, target: string, message: string): Promise<boolean> => {
    try {
        const formData = new FormData();
        formData.append('target', target);
        formData.append('message', message);
        formData.append('countryCode', '62'); 

        const response = await fetch(settings.waBaseUrl, {
            method: 'POST',
            headers: { 'Authorization': settings.waApiKey },
            body: formData
        });

        const result = await response.json();
        return !!result.status;
    } catch (error) {
        console.error('AutoReport: Network Error', error);
        return false;
    }
};

const calculateStats = (responses: any[], questions: any[]) => {
    return questions.map(q => {
        if (q.type === 'text') return { label: q.label, value: 'Isian Teks' };
        const valid = responses.filter((r: any) => typeof r.answers[q.id] === 'number');
        if (valid.length === 0) return { label: q.label, value: '0.0' };
        const sum = valid.reduce((a: number, b: any) => a + (b.answers[q.id] as number), 0);
        const avgVal = sum / valid.length;
        const avg = avgVal.toFixed(2);
        
        let display = '';
        if (q.type === 'star') {
            const label = getScoreLabel(avgVal, 'star');
            display = `${avg}/5.0 (${label})`;
        } else {
            const label = getScoreLabel(avgVal, 'slider');
            // Remove /100 suffix
            display = `${avg} (${label})`;
        }
        return { label: q.label, value: display };
    });
};

const calculateOverallStats = (items: any[], qs: any[]) => {
    const starQs = qs.filter((q: any) => q.type === 'star');
    let starAvg = 0;
    if (starQs.length > 0) {
        let totalScore = 0;
        let totalCount = 0;
        starQs.forEach((q: any) => {
           const valid = items.filter((r: any) => typeof r.answers[q.id] === 'number');
           if(valid.length) {
               totalScore += valid.reduce((a: number,b: any) => a + (b.answers[q.id] as number), 0);
               totalCount += valid.length;
           }
        });
        starAvg = totalCount ? Number((totalScore / totalCount).toFixed(2)) : 0;
    }

    const sliderQs = qs.filter((q: any) => q.type === 'slider');
    let sliderAvg = 0;
    if (sliderQs.length > 0) {
        let totalScore = 0;
        let totalCount = 0;
        sliderQs.forEach((q: any) => {
           const valid = items.filter((r: any) => typeof r.answers[q.id] === 'number');
           if(valid.length) {
               totalScore += valid.reduce((a: number,b: any) => a + (b.answers[q.id] as number), 0);
               totalCount += valid.length;
           }
        });
        sliderAvg = totalCount ? Number((totalScore / totalCount).toFixed(2)) : 0;
    }
    return { starAvg, sliderAvg, hasStar: starQs.length > 0, hasSlider: sliderQs.length > 0 };
};
