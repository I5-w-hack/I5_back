from django.shortcuts import render
from django.http import JsonResponse
import PyPDF2, docx, json
from konlpy.tag import Okt  # 여기는 OK
import tempfile, os 
from words.services import find_or_create_word, toggle_bookmark_services
from words.models import Bookmark
from django.contrib.auth.decorators import login_required

okt=Okt()

def upload(request):
    # print("--디버깅 1. upload 뷰에 요청 도착착")
    paragraphs = []
    if request.method == "POST":
        try:
            file = request.FILES["document"]
            print(f"--디버깅 2. 파일 수신 완료. 파일명: {file.name}")
            if file.name.endswith(".pdf"):
                reader = PyPDF2.PdfReader(file)
                for page in reader.pages:
                    page_text = page.extract_text()
                    if page_text:
                        paragraphs.extend(page_text.split('\n'))

            elif file.name.endswith(".docx"):
                doc = docx.Document(file)
                paragraphs = [p.text for p in doc.paragraphs if p.text]

            elif file.name.endswith(".txt"):
                text = file.read().decode("utf-8")
                paragraphs = text.splitlines()

            paragraphs = [p for p in paragraphs if p.strip()]
            print(f"--디버깅 3. 파일 처리 완료. docs3.html렌더링")
            return render(request,"converter/docs3.html",{"paragraphs":paragraphs})
        except PyPDF2.errors.PdfReadError as e:
        # PDF 암호 오류 등 PyPDF2 관련 오류 처리
            print(f"--- [오류] PDF 처리 오류 발생: {e} ---")
            return render(request, "converter/converter.html", {"error": "PDF 파일을 읽을 수 없습니다. 파일이 손상되었거나 암호화되어 있습니다."})
        
        except KeyError:
            # request.FILES["document"]가 없을 경우 (HTML 폼 문제)
            print("--- [오류] 폼 제출 문제: 'document' 파일을 찾을 수 없음. ---")
            return render(request, "converter/converter.html", {"error": "파일이 올바르게 첨부되지 않았습니다."})
        
        except Exception as e:
            # 기타 예상치 못한 모든 오류 처리
            print(f"--- [심각 오류] 파일 처리 중 예상치 못한 오류 발생: {e} ---")
            return render(request, "converter/converter.html", {"error": f"파일 처리 중 오류가 발생했습니다: {e}"})

    # GET 요청 시 (처음 접속)
    print("--- [디버깅] 4. GET 요청: converter.html 렌더링 ---")
    #return render(request, "converter/converter.html", {"paragraphs": paragraphs})
    return render(request, "converter/converter.html")


def meaning(request):
    word = request.GET.get("word")
    
    if not word:
        return JsonResponse({"definitions": ["단어 없음"], "word": ""})

    # 3. KoNLPy로 단어를 '정리'합니다 (구두점 제거)
    punctuation = ".,!?;:\"'()[]{}" 
    cleaned_word = word.strip(punctuation) # 예: "컴퓨터를." -> "컴퓨터를"

    if not cleaned_word:
         return JsonResponse({"definitions": ["뜻을 찾을 수 없는 단어입니다."], "word": word})

    # 4. KoNLPy로 '핵심 단어'(명사, 동사 등)를 추출합니다.
    # 'stem=True'로 기본형을 찾습니다.
    pos_tags = okt.pos(cleaned_word, stem=True)
    
    search_word = None
    for tag, pos in pos_tags:
        # 명사, 동사, 형용사, 알파벳만 검색 대상으로 인정
        if pos in ['Noun', 'Verb', 'Adjective', 'Alpha']:
            search_word = tag
            break
    
    # 적절한 단어를 못찾으면 그냥 정리된 단어(조사 뗀 단어)를 사용
    if search_word is None:
        search_word = cleaned_word.rstrip('을를이가는은도') # 간단한 조사 제거
    
    # 5. [매우 중요] KoNLPy가 찾은 '핵심 단어'로 '사전'을 검색합니다.
    try:
        # 'okt.morphs()'가 아니라 'find_or_create_word'를 호출해야 합니다!
        word_obj = find_or_create_word(search_word) # 예: "컴퓨터"로 검색
        
        # 6. '뜻'을 가져옵니다.
        definitions = word_obj.definitions.all()
        def_list = [d.text for d in definitions]

        is_bookmarked = False
        if request.user.is_authenticated:
            is_bookmarked = Bookmark.objects.filter(user=request.user, word=word_obj).exists()
        
        if not def_list:
            def_list = ["사전에서 뜻을 찾을 수 없습니다."]

        # 7. '뜻 리스트'를 반환합니다.
        return JsonResponse({
            "definitions": def_list,
            "word": search_word,
            "id": word_obj.id,            
            "is_bookmarked": is_bookmarked,
            "is_authenticated": request.user.is_authenticated })

    except Exception as e:
        # 8. 'find_or_create_word' 실행 중 에러가 나면 (API, DB 등)
        print(f"Error in meaning view (service call): {e}") # 서버 터미널에 로그
        return JsonResponse({"definitions": [f"사전 검색 중 오류 발생: {str(e)}"], "word": search_word}, status=500)

@login_required
def toggle_bookmark(request):
    if request.method=="POST":
        try:
            data = json.loads(request.body)
            word_id = data.get('word_id')
            
            # 서비스 로직 호출 (True: 저장됨, False: 삭제됨)
            is_bookmarked = toggle_bookmark_services(request.user, word_id)
            
            return JsonResponse({'status': 'success', 'is_bookmarked': is_bookmarked})
        except Exception as e:
            return JsonResponse({'status': 'error', 'message': str(e)}, status=400)