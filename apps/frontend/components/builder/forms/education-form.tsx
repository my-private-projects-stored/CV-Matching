'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Education } from '@/components/dashboard/resume-component';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { DraggableListItem } from '../draggable-list-item';

interface EducationFormProps {
  data: Education[];
  onChange: (data: Education[]) => void;
}

export const EducationForm: React.FC<EducationFormProps> = ({ data, onChange }) => {
  const { t } = useTranslations();

  // Configure drag-and-drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handler for drag end event
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = data.findIndex((item) => item.id === active.id);
    const newIndex = data.findIndex((item) => item.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // Reorder the array using arrayMove from @dnd-kit
    const reordered = arrayMove(data, oldIndex, newIndex);
    onChange(reordered);
  };

  const handleAdd = () => {
    const newId = Math.max(...data.map((d) => d.id), 0) + 1;
    onChange([
      ...data,
      {
        id: newId,
        institution: '',
        degree: '',
        years: '',
        description: '',
      },
    ]);
  };

  const handleRemove = (id: number) => {
    onChange(data.filter((item) => item.id !== id));
  };

  const handleChange = (id: number, field: keyof Education, value: string) => {
    onChange(
      data.map((item) => {
        if (item.id === id) {
          return { ...item, [field]: value };
        }
        return item;
      })
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleAdd} className="rounded-xl">
          <Plus className="w-4 h-4 mr-2" /> {t('builder.forms.education.addSchool')}
        </Button>
      </div>

      {data.length === 0 ? (
        <div className="text-center py-12 bg-[var(--surface-muted)] border border-dashed border-[color:var(--border)] rounded-2xl">
          <p className="text-sm text-[color:var(--text-subtle)] mb-4">
            {t('builder.genericItemForm.noEntries', { label: t('resume.sections.education') })}
          </p>
          <Button variant="outline" size="sm" onClick={handleAdd} className="rounded-xl">
            <Plus className="w-4 h-4 mr-2" /> {t('builder.forms.education.addFirstSchool')}
          </Button>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={data.map((item) => item.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-8">
              {data.map((item) => (
                <DraggableListItem key={item.id} id={item.id}>
                  <div className="p-6 rounded-2xl border border-[color:var(--border)] bg-[var(--surface-muted)] relative group">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleRemove(item.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 pr-8">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-subtle)]">
                          {t('builder.forms.education.fields.institution')}
                        </Label>
                        <Input
                          value={item.institution || ''}
                          onChange={(e) => handleChange(item.id, 'institution', e.target.value)}
                          placeholder={t('builder.forms.education.placeholders.institution')}
                          className="rounded-xl border-[color:var(--border)] bg-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-subtle)]">
                          {t('builder.forms.education.fields.degree')}
                        </Label>
                        <Input
                          value={item.degree || ''}
                          onChange={(e) => handleChange(item.id, 'degree', e.target.value)}
                          placeholder={t('builder.forms.education.placeholders.degree')}
                          className="rounded-xl border-[color:var(--border)] bg-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-subtle)]">
                          {t('builder.genericItemForm.fields.years')}
                        </Label>
                        <Input
                          value={item.years || ''}
                          onChange={(e) => handleChange(item.id, 'years', e.target.value)}
                          placeholder={t('builder.forms.education.placeholders.years')}
                          className="rounded-xl border-[color:var(--border)] bg-white"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-subtle)]">
                        {t('builder.forms.education.fields.descriptionOptional')}
                      </Label>
                      <Textarea
                        value={item.description || ''}
                        onChange={(e) => handleChange(item.id, 'description', e.target.value)}
                        className="min-h-[60px] text-[var(--foreground)] text-sm rounded-xl border-[color:var(--border)] bg-white"
                        placeholder={t('builder.forms.education.placeholders.description')}
                      />
                    </div>
                  </div>
                </DraggableListItem>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
};
