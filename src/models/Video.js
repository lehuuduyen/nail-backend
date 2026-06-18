const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Video = sequelize.define(
    'Video',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      youtubeId: {
        type: DataTypes.STRING(20),
        allowNull: false,
        comment: 'YouTube video ID, e.g. dQw4w9WgXcQ',
      },
      title: { type: DataTypes.STRING(200), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      uploadDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        comment: 'ISO date (YYYY-MM-DD) — for VideoObject schema uploadDate',
      },
      durationSeconds: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Optional, used to build ISO 8601 duration for schema',
      },
      featured: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'true = show on homepage Featured section',
      },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      displayOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    {
      tableName: 'videos',
      timestamps: true,
    }
  );
  return Video;
};
