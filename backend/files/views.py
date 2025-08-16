from rest_framework import viewsets, status, filters
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db.models import Q, Count, Sum
from django_filters import rest_framework as django_filters
from .models import File, calculate_file_hash
from .serializers import FileSerializer
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.pagination import PageNumberPagination
from django.utils import timezone
from django.core.cache import cache


class FileFilter(django_filters.FilterSet):
    min_size = django_filters.NumberFilter(field_name="size", lookup_expr='gte')
    max_size = django_filters.NumberFilter(field_name="size", lookup_expr='lte')
    file_type = django_filters.CharFilter(field_name="file_type", lookup_expr='icontains')
    filename = django_filters.CharFilter(field_name="original_filename", lookup_expr='icontains')
    
    uploaded_after = django_filters.DateTimeFilter(
        field_name="uploaded_at", 
        lookup_expr='gte',
        input_formats=['%Y-%m-%dT%H:%M', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%d']
    )
    uploaded_before = django_filters.DateTimeFilter(
        field_name="uploaded_at", 
        lookup_expr='lte',
        input_formats=['%Y-%m-%dT%H:%M', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%d']
    )

    class Meta:
        model = File
        fields = ['file_type', 'min_size', 'max_size', 'uploaded_after', 'uploaded_before', 'filename']


class OptimizedFilePagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 200
    
    def get_paginated_response(self, data):
        return Response({
            'count': self.page.paginator.count,
            'next': self.get_next_link(),
            'previous': self.get_previous_link(),
            'results': data,
            'page': self.page.number,
            'total_pages': self.page.paginator.num_pages,
        })


class FileViewSet(viewsets.ModelViewSet):
    queryset = File.objects.all()
    serializer_class = FileSerializer
    pagination_class = OptimizedFilePagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = FileFilter
    search_fields = ['original_filename', 'file_type']
    ordering_fields = ['uploaded_at', 'size', 'original_filename']
    
    def find_original_by_hash(self, file_hash):
        """Find the original file for a given hash"""
        original = File.objects.filter(file_hash=file_hash, is_duplicate=False).first()
        
        if original:
            return original
            
        # If no original found, promote the earliest uploaded file as original
        earliest_file = File.objects.filter(file_hash=file_hash).order_by('uploaded_at').first()
        
        if earliest_file:
            earliest_file.is_duplicate = False
            earliest_file.original_file = None
            earliest_file.reference_count = 1
            earliest_file.duplicate_ids = []
            earliest_file.total_space_saved = 0
            earliest_file.save()
            
            # Update all other files with this hash to point to the new original
            other_files = File.objects.filter(file_hash=file_hash).exclude(id=earliest_file.id)
            for other_file in other_files:
                other_file.original_file = earliest_file
                other_file.is_duplicate = True
                other_file.save()
            
            return earliest_file
        
        return None
    
    def update_reference_count_for_original(self, original_file):
        """Update reference count for an original file based on its duplicates"""
        duplicates = File.objects.filter(original_file=original_file, is_duplicate=True)
        duplicate_count = duplicates.count()
        duplicate_ids = [str(dup.id) for dup in duplicates]
        
        original_file.reference_count = duplicate_count + 1
        original_file.total_space_saved = sum(dup.size for dup in duplicates)
        original_file.duplicate_ids = duplicate_ids
        original_file.save()
        
        return original_file
    
    def get_queryset(self):
        """Optimized queryset with caching"""
        cache_key = f"file_queryset_{hash(str(self.request.query_params))}"
        
        cached_queryset = cache.get(cache_key)
        if cached_queryset is not None:
            return cached_queryset
        
        queryset = File.objects.select_related('original_file').prefetch_related('duplicates')
        filterset = self.filterset_class(self.request.query_params, queryset=queryset)
        filtered_queryset = filterset.qs
        
        if not self.request.query_params.get('ordering'):
            filtered_queryset = filtered_queryset.order_by('-uploaded_at')
        
        cache.set(cache_key, filtered_queryset, 300)
        return filtered_queryset

    def invalidate_cache(self):
        """Invalidate all file-related caches"""
        cache.delete('storage_savings_stats')
        cache.clear()

    def create(self, request, *args, **kwargs):
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)
        
        file_obj.seek(0)
        file_hash = calculate_file_hash(file_obj)
        file_obj.seek(0)
        
        # Check for duplicate
        existing_file = self.find_original_by_hash(file_hash)
        
        # Check for recent upload of the same file (within last 1 minutes)
        recent_upload = File.objects.filter(
            file_hash=file_hash,
            uploaded_at__gte=timezone.now() - timezone.timedelta(minutes=1)
        ).order_by('-uploaded_at').first()
        
        if recent_upload:
            time_diff = timezone.now() - recent_upload.uploaded_at
            minutes_ago = int(time_diff.total_seconds() / 60)
            seconds_ago = int(time_diff.total_seconds() % 60)
            
            time_message = f"{minutes_ago} minute(s) and {seconds_ago} second(s) ago"
            if minutes_ago == 0:
                time_message = f"{seconds_ago} second(s) ago"
            
            return Response({
                'error': f'This file was uploaded {time_message}. Please wait 1 minutes between uploads of the same file.',
                'recent_upload': {
                    'id': str(recent_upload.id),
                    'filename': recent_upload.original_filename,
                    'uploaded_at': recent_upload.uploaded_at,
                }
            }, status=status.HTTP_429_TOO_MANY_REQUESTS)
        
        if existing_file:
            # Create duplicate
            data = {
                'original_filename': file_obj.name,
                'file_type': file_obj.content_type,
                'size': file_obj.size,
                'file_hash': file_hash,
                'is_duplicate': True,
                'original_file': existing_file.id,
                'file': existing_file.file,
                'reference_count': 0,
                'total_space_saved': 0
            }
            file_obj.close()
        else:
            # Create new file
            data = {
                'file': file_obj,
                'original_filename': file_obj.name,
                'file_type': file_obj.content_type,
                'size': file_obj.size,
                'file_hash': file_hash,
                'is_duplicate': False,
                'reference_count': 1,
                'total_space_saved': 0
            }
        
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        
        # Update reference count if duplicate
        if serializer.instance.is_duplicate and serializer.instance.original_file:
            self.update_reference_count_for_original(serializer.instance.original_file)
        
        headers = self.get_success_headers(serializer.data)
        self.invalidate_cache()
        
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        new_original = None
        original_to_update = None
        
        if instance.is_duplicate and instance.original_file:
            # Deleting a duplicate file
            original_to_update = instance.original_file
        elif not instance.is_duplicate and instance.duplicates.exists():
            # Deleting an original file that has duplicates
            all_duplicates = list(instance.duplicates.all().order_by('uploaded_at'))
            if all_duplicates:
                new_original = all_duplicates[0]  # Earliest uploaded file
                remaining_duplicates = all_duplicates[1:]
                
                # Promote the earliest duplicate to original
                new_original.is_duplicate = False
                new_original.original_file = None
                new_original.reference_count = 1
                new_original.total_space_saved = 0
                new_original.save()
                
                # Update remaining duplicates to point to new original
                for duplicate in remaining_duplicates:
                    duplicate.original_file = new_original
                    duplicate.save()
        
        # Perform deletion
        result = super().destroy(request, *args, **kwargs)
        
        # Update reference counts after deletion
        if instance.is_duplicate and original_to_update:
            self.update_reference_count_for_original(original_to_update)
        elif not instance.is_duplicate and new_original:
            self.update_reference_count_for_original(new_original)
            
            # Fix any orphaned duplicates
            orphaned = File.objects.filter(original_file_id=instance.id, is_duplicate=True)
            for orphan in orphaned:
                orphan.original_file = new_original
                orphan.save()
            
            self.update_reference_count_for_original(new_original)
        
        self.invalidate_cache()
        return result

    @action(detail=False, methods=['get'])
    def storage_savings(self, request):
        """Get storage savings statistics"""
        cache_key = 'storage_savings_stats'
        cache_timeout = 300
        
        cached_stats = cache.get(cache_key)
        if cached_stats:
            return Response(cached_stats)
        
        stats = File.objects.aggregate(
            total_saved=Sum('size', filter=Q(is_duplicate=True)),
            total_files=Count('id'),
            duplicate_files=Count('id', filter=Q(is_duplicate=True)),
            original_files=Count('id', filter=Q(is_duplicate=False))
        )
        
        most_duplicated = File.objects.filter(
            is_duplicate=False, 
            reference_count__gt=1
        ).select_related().order_by('-reference_count').first()
        
        savings_stats = {
            'total_bytes_saved': stats['total_saved'] or 0,
            'total_mb_saved': (stats['total_saved'] or 0) / (1024 * 1024),
            'total_files': stats['total_files'],
            'duplicate_files': stats['duplicate_files'],
            'original_files': stats['original_files'],
            'most_duplicated_file': {
                'filename': most_duplicated.original_filename,
                'reference_count': most_duplicated.reference_count,
                'space_saved': most_duplicated.total_space_saved
            } if most_duplicated else None
        }
        
        cache.set(cache_key, savings_stats, cache_timeout)
        return Response(savings_stats)

    @action(detail=False, methods=['get'])
    def refresh_file_status(self, request):
        """Refresh file status and relationships"""
        # Fix orphaned duplicates
        orphaned_duplicates = File.objects.filter(is_duplicate=True, original_file__isnull=True)
        for orphan in orphaned_duplicates:
            same_hash_files = File.objects.filter(file_hash=orphan.file_hash)
            original = same_hash_files.filter(is_duplicate=False).first()
            
            if original:
                orphan.original_file = original
                orphan.save()
            else:
                # Promote earliest file as original
                earliest_file = same_hash_files.order_by('uploaded_at').first()
                if earliest_file:
                    earliest_file.is_duplicate = False
                    earliest_file.original_file = None
                    earliest_file.reference_count = 1
                    earliest_file.duplicate_ids = []
                    earliest_file.save()
                    
                    other_files = same_hash_files.exclude(id=earliest_file.id)
                    for other_file in other_files:
                        other_file.original_file = earliest_file
                        other_file.is_duplicate = True
                        other_file.save()
        
        # Update all reference counts
        original_files = File.objects.filter(is_duplicate=False)
        for original in original_files:
            self.update_reference_count_for_original(original)
        
        return Response({
            'message': 'File status refreshed',
            'total_files': File.objects.count(),
            'original_files': File.objects.filter(is_duplicate=False).count(),
            'duplicate_files': File.objects.filter(is_duplicate=True).count()
        })