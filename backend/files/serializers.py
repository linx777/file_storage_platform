from rest_framework import serializers
from .models import File

class FileSerializer(serializers.ModelSerializer):
    storage_saved = serializers.IntegerField(read_only=True)

    class Meta:
        model = File
        fields = [
            'id', 'file', 'original_filename', 'file_type', 
            'size', 'uploaded_at', 'is_duplicate', 'storage_saved',
            'file_hash', 'original_file', 'reference_count', 'total_space_saved', 'duplicate_ids'
        ]
        read_only_fields = ['id', 'uploaded_at', 'storage_saved']