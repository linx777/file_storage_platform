from django.db import models
import uuid
import os
import hashlib

def file_upload_path(instance, filename):
    """Generate file path for new file upload"""
    ext = filename.split('.')[-1]
    filename = f"{uuid.uuid4()}.{ext}"
    return os.path.join('uploads', filename)

def calculate_file_hash(file):
    """Calculate SHA-256 hash of file"""
    sha256_hash = hashlib.sha256()
    # Save current position
    current_pos = file.tell()
    # Reset to beginning
    file.seek(0)
    
    try:
        for chunk in file.chunks():
            sha256_hash.update(chunk)
        return sha256_hash.hexdigest()
    finally:
        # Restore original position
        file.seek(current_pos)

class File(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    file = models.FileField(upload_to=file_upload_path)
    original_filename = models.CharField(max_length=255)
    file_type = models.CharField(max_length=100)
    size = models.BigIntegerField()
    uploaded_at = models.DateTimeField(auto_now_add=True)
    file_hash = models.CharField(max_length=64, db_index=True)  # SHA-256 hash
    is_duplicate = models.BooleanField(default=False)
    original_file = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL, related_name='duplicates')
    reference_count = models.PositiveIntegerField(default=1)  # Track number of references to this file
    total_space_saved = models.BigIntegerField(default=0)  # Track cumulative space saved by this file's duplicates
    duplicate_ids = models.JSONField(default=list, blank=True)  # List of duplicate file IDs that reference this original
    
    class Meta:
        ordering = ['-uploaded_at']
        indexes = [
            # Single field indexes for basic filtering
            models.Index(fields=['file_type']),
            models.Index(fields=['size']),
            models.Index(fields=['uploaded_at']),
            models.Index(fields=['file_hash']),
            models.Index(fields=['reference_count']),
            models.Index(fields=['is_duplicate']),
            
            # Composite indexes for common query patterns
            models.Index(fields=['file_type', 'size']),
            models.Index(fields=['uploaded_at', 'size']),
            models.Index(fields=['is_duplicate', 'size']),
            models.Index(fields=['file_type', 'uploaded_at']),
            
            # Text search indexes
            models.Index(fields=['original_filename']),
            models.Index(fields=['file_type', 'original_filename']),
            
            # Performance indexes for deduplication queries
            models.Index(fields=['file_hash', 'is_duplicate']),
            models.Index(fields=['original_file', 'is_duplicate']),
        ]
    
    def __str__(self):
        return self.original_filename

    def update_reference_count(self):
        """Update reference count when a duplicate is created or deleted"""
        if self.original_file:
            original = self.original_file
            duplicate_count = original.duplicates.count()
            original.reference_count = duplicate_count + 1  # +1 for the original file itself
            original.total_space_saved = original.size * duplicate_count  # Space saved by duplicates
            # Use update to avoid triggering save() method and potential recursion
            File.objects.filter(id=original.id).update(
                reference_count=duplicate_count + 1,
                total_space_saved=original.size * duplicate_count
            )
        elif not self.is_duplicate:
            # This is an original file
            duplicate_count = self.duplicates.count()
            # Use update to avoid triggering save() method and potential recursion
            File.objects.filter(id=self.id).update(
                reference_count=duplicate_count + 1,
                total_space_saved=self.size * duplicate_count
            )

    def save(self, *args, **kwargs):
        """Override save method - simplified to avoid conflicts with view logic"""
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        """Override delete method - logic now handled in views"""
        super().delete(*args, **kwargs)

    @property
    def storage_saved(self):
        """Calculate storage saved by this file
        - For duplicates: returns the size of the file (since we don't store it)
        - For originals: returns 0 (they are stored, so no savings for the original itself)
        """
        if self.is_duplicate:
            return self.size  # This file is a duplicate, so we saved its entire size
        return 0  # Original files are stored, so no savings for the original itself

    @classmethod
    def get_total_storage_saved(cls):
        """Calculate total storage saved through deduplication"""
        # Total storage saved = sum of all duplicate file sizes
        # (since we don't actually store duplicate files on disk)
        total_saved = cls.objects.filter(is_duplicate=True).aggregate(
            total_saved=models.Sum('size')
        )['total_saved'] or 0
        
        return total_saved