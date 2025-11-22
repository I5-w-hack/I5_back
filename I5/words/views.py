from django.shortcuts import render, redirect,get_object_or_404
from .services import find_or_create_word, toggle_bookmark_services
from django.urls import reverse
from .models import Bookmark, Word
from django.contrib.auth.decorators import login_required

def word_search(request):
    '''
    /words/dictionary/
    '''

    query = request.GET.get('query')
    word = None
    error_message = None
    is_bookmarked = False

    if( query ):
        try:
            word = find_or_create_word(query)

            if request.user.is_authenticated and word:
                is_bookmarked = Bookmark.objects.filter(user=request.user, word=word).exists()
       
        except Exception as e:
            print(f"[V]Error in word_search : {e}")
            error_message = str(e)

    context = {
        'query' : query, #검색어
        'word' : word,  #검색 단어 저장
        'error_message' : error_message,
        'is_bookmarked' : is_bookmarked #북마크 되어 있는지, T -> 북마크 아이콘 색칠하기
    }
    
    return render(request, 'words/word_search.html', context)

def todays_words(request):
    '''
    /words/todays-words/
    
    '''
    from .services import get_todays_words
    words = get_todays_words()
    
    context = {
        'words': words
    }
    return

# 로그인 기능이 필요하므로 데코레이터 추가
@login_required
def toggle_bookmark(request, word_id):
    """
    북마크 토글 기능, 검색이 후 단어가 뜨는 창에서 나타남. 
    - 로그인한 유저만 접근 가능

    토클 표시나 직접적으로 보이는 것은 위 word_search 에서 처리 ( is_bookmarked )
    """
    toggle_bookmark_services(request.user, word_id)
    
    word = get_object_or_404(Word, pk=word_id)
    # 처리가 끝나면 이전 페이지(보통 단어 상세 페이지)로 리다이렉트
    base_url = reverse('words:word_search') 
    query_string = f"?query={word.text}"
    
    return redirect(base_url + query_string)

@login_required
def bookmark_list(request):
    '''
    /words/bookmarklist/
    사용자의 북마크된 단어 목록을 보여주는 뷰
    '''
    sort_option = request.GET.get('sort', 'recent')

    # 1. 기본 쿼리셋
    bookmarks = Bookmark.objects.filter(user=request.user).select_related('word')

    # 2. 정렬 로직
    if sort_option == 'random':
        bookmarks = bookmarks.order_by('?') 
    elif sort_option == 'alphabetical':
        bookmarks = bookmarks.order_by('word__text')
    elif sort_option == 'frequency':
        bookmarks = bookmarks.order_by('-word__search_count')
    else: # recent (기본값)
        bookmarks = bookmarks.order_by('-id')

    words = [bookmark.word for bookmark in bookmarks]
   
    words_data = []
    for word in words:
        words_data.append({
            'text': word.text,
            'definitions': [d.text for d in word.definitions.all()] 
        })
    
    context = {
        'words': words,           # HTML 렌더링용
        'words_data': words_data, # JS 데이터 전달용
        'sort_option': sort_option,
    }
    return render(request, 'words/book_mark.html', context)

