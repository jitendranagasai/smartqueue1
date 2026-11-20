import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IService extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  name: string;
  prefix: string;
  averageServiceTime: number;
  enabled: boolean;
  open: boolean;
  capacity: number;
  createdAt: Date;
  updatedAt: Date;
}

const serviceSchema = new Schema<IService>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true },
    prefix: { type: String, required: true, uppercase: true, trim: true },
    averageServiceTime: { type: Number, default: 8, min: 1 },
    enabled: { type: Boolean, default: true },
    open: { type: Boolean, default: true },
    capacity: { type: Number, default: 50, min: 1 }
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: any) {
        ret.id = ret._id.toString();
        ret.orgId = ret.organizationId?.toString();
        ret.avg = ret.averageServiceTime;
        ret.cap = ret.capacity;
        delete ret.__v;
        return ret;
      }
    }
  }
);

serviceSchema.index({ organizationId: 1, name: 1 });

export const Service = mongoose.model<IService>('Service', serviceSchema);
