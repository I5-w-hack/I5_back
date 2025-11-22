// -------------------------- [설정] --------------------------
// urls.py에 설정된 URL과 일치해야 합니다.
const MEANING_URL = "/converter/meaning/"; 
const BOOKMARK_URL = "/converter/bookmark/"; // views.toggle_bookmark와 매핑된 URL

// -------------------------- 요소 선택 --------------------------
const page = document.getElementById("document-page");
const sidebar = document.getElementById("sidebar");
const wordList = document.getElementById("word-list"); 
const closeBtn = document.getElementById("closePanel");
const zoomInBtn = document.getElementById("zoomIn");
const zoomOutBtn = document.getElementById("zoomOut");
const filterButtons = document.querySelectorAll('.translation-filter .filter-btn');

// -------------------------- 유틸리티: CSRF 토큰 --------------------------
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

// -------------------------- 문서 줌 기능 --------------------------
let scale = 1;

if (zoomInBtn) {
    zoomInBtn.onclick = () => {
        scale = Math.min(2.0, scale + 0.1); 
        if (page) page.style.transform = `scale(${scale})`;
    };
}

if (zoomOutBtn) {
    zoomOutBtn.onclick = () => {
        scale = Math.max(0.5, scale - 0.1); 
        if (page) page.style.transform = `scale(${scale})`;
    };
}

/* ------------------------- 
   본문 단어 클릭 이벤트
------------------------- */
document.addEventListener("click", (e) => {
    if (e.target.classList.contains("word")) {
        const rawWord = e.target.innerText;
        const cleanWord = rawWord.replace(/[^가-힣a-zA-Z0-9]/g, "").trim();

        if (!cleanWord) return;

        openSidebar(); 
        
        if (highlightExistingWord(cleanWord)) return;

        fetchAndAddWord(cleanWord);
    }
});

function openSidebar() {
    if (sidebar) {
        sidebar.classList.remove("hidden");
        setTimeout(() => {
            sidebar.classList.add("open");
        }, 10);
    }
}

function highlightExistingWord(word) {
    if (!wordList) return false;
    const items = wordList.querySelectorAll('.word-item');
    for (let item of items) {
        const titleSpan = item.querySelector('.word-header span'); 
        if (titleSpan) {
            const currentTitle = titleSpan.innerText.replace(/[📌]/g, '').trim();
            if (currentTitle === word) {
                item.style.opacity = "0.5";
                setTimeout(() => { item.style.opacity = "1"; }, 300);
                
                const body = item.querySelector(".word-body");
                const icon = item.querySelector(".toggle-icon");
                if(body && body.style.display === "none"){
                    body.style.display = "block";
                    if(icon) icon.innerText = "▲";
                }
                
                item.scrollIntoView({ behavior: "smooth", block: "center" });
                return true;
            }
        }
    }
    return false;
}

/* -------------------------
   단어 추가 및 서버 요청 함수 (핵심 수정됨)
------------------------- */
function fetchAndAddWord(searchWord) {
    if (!wordList) return;

    // 1. 카드 틀 생성
    const item = document.createElement("div");
    item.className = "word-item"; 

    item.innerHTML = `
        <div class="word-header" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: bold;">${searchWord}📌</span>
            <span class="toggle-icon" style="font-size: 0.8em; opacity: 0.7;">▼</span> 
        </div>
        
        <div class="word-body" style="display: none; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(0,0,0,0.1);">
            <p class="loading-msg" style="margin: 0; font-size: 0.9em; opacity: 0.7;">검색 중...</p>
        </div>
    `;

    wordList.prepend(item);

    const header = item.querySelector(".word-header");
    const body = item.querySelector(".word-body");
    const icon = item.querySelector(".toggle-icon");

    body.style.display = "block";
    icon.innerText = "▲";

    header.addEventListener("click", () => {
        if (body.style.display === "none") {
            body.style.display = "block";
            icon.innerText = "▲";
        } else {
            body.style.display = "none";
            icon.innerText = "▼";
        }
    });

    // 2. 서버 요청
    fetch(`${MEANING_URL}?word=${searchWord}`)
        .then(res => res.json())
        .then(data => {
            // 제목 업데이트
            if (data.word && data.word.trim() !== "") {
                const titleSpan = item.querySelector(".word-header span");
                if(titleSpan) titleSpan.innerText = `${data.word}📌`;
            }

            // 뜻 생성
            let definitionsHtml = "";
            if (Array.isArray(data.definitions) && data.definitions.length > 0) {
                definitionsHtml = `<ul style="padding-left: 18px; margin: 5px 0;">` + 
                                  data.definitions.map(def => `<li>${def}</li>`).join('') + 
                                  `</ul>`;
            } else {
                definitionsHtml = "<div style='opacity:0.6;'>뜻이 없습니다.</div>";
            }

            // ★ [수정됨] 버튼 HTML 생성 로직
            let buttonHtml = ""; // 기본값은 빈 문자열 (버튼 없음)

            // 로그인이 되어 있는 경우에만 버튼 코드를 생성
            if (data.is_authenticated) {
                const btnText = data.is_bookmarked ? "저장 취소" : "단어장에 저장";
                const btnStyle = data.is_bookmarked 
                    ? "width: 100%; margin-top: 5px; cursor: pointer; background-color: #ddd; color: #333;" 
                    : "width: 100%; margin-top: 5px; cursor: pointer;";
                
                buttonHtml = `
                    <button class="save-btn" data-id="${data.id}" style="${btnStyle}">
                        ${btnText}
                    </button>
                `;
            }

            // HTML 업데이트 (뜻 + 버튼(있을수도 없을수도))
            body.innerHTML = `
                <div style="margin-bottom: 8px; font-size: 0.95em;">
                    ${definitionsHtml}
                </div>
                ${buttonHtml}
            `;
        })
        .catch(error => {
            console.error("Fetch error:", error);
            body.innerHTML = `<p style="color: red; margin: 0;">정보를 가져올 수 없습니다.</p>`;
        });
}

/* -------------------------
   [저장 버튼 클릭 이벤트] - Event Delegation 사용
------------------------- */
if (wordList) {
    wordList.addEventListener("click", (e) => {
        // 'save-btn' 클래스를 가진 요소를 클릭했을 때만 동작
        if (e.target.classList.contains("save-btn")) {
            const btn = e.target;
            const wordId = btn.getAttribute("data-id"); // HTML에 심어둔 ID 가져오기
            
            // ID가 없거나 로딩 전이면 중단
            if (!wordId || wordId === "undefined" || wordId === "null") {
                alert("단어 정보를 불러오는 중입니다.");
                return;
            }
            
            // 실제 서버 통신 함수 호출
            toggleBookmark(wordId, btn);
        }
    });
}

// 서버와 통신하여 북마크 토글
function toggleBookmark(wordId, btn) {
    fetch(BOOKMARK_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": getCookie("csrftoken"), // Django CSRF 보호 통과
        },
        body: JSON.stringify({
            word_id: wordId
        }),
    })
    .then(response => {
        if (response.status === 403) {
            alert("로그인이 필요한 서비스입니다.");
            return null; 
        }
        return response.json();
    })
    .then(data => {
        if (!data) return;

        if (data.status === 'success') {
            // 성공 시 UI 즉시 업데이트 (새로고침 X)
            if (data.is_bookmarked) {
                // 저장됨 상태로 변경
                btn.innerText = "저장 취소";
                btn.style.backgroundColor = "#ddd";
                btn.style.color = "#333";
            } else {
                // 저장 해제 상태로 변경
                btn.innerText = "단어장에 저장";
                btn.style.backgroundColor = ""; // CSS 클래스 기본값으로 복귀
                btn.style.color = "";
            }
        } else {
            alert("오류: " + data.message);
        }
    })
    .catch(error => {
        console.error("Error:", error);
        alert("서버 통신 중 오류가 발생했습니다.");
    });
}

// -------------------------- 닫기 버튼 --------------------------
if (closeBtn && sidebar) {
    closeBtn.addEventListener("click", () => {
        sidebar.classList.remove("open");
        setTimeout(() => {
            sidebar.classList.add("hidden");
        }, 300); 
    });
}

// 필터 버튼
filterButtons.forEach(button => {
    button.addEventListener('click', function() {
        filterButtons.forEach(btn => btn.classList.remove('active'));
        this.classList.add('active');
        
        if(this.textContent.trim() === '단어') {
             // 필요시 구현
        } else {
            window.location.href = '/words/dictionary/';
        }
    });
});