from django.urls import path
from . import views

app_name = 'converter'
urlpatterns = [
    path('', views.upload, name='upload'),
    path('meaning/', views.meaning, name='meaning'),
    path('bookmark/',views.toggle_bookmark, name='bookmark'),
]
